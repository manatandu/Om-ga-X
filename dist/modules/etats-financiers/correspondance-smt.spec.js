"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_smt_1 = require("./correspondance-smt");
const compte_seed_1 = require("../comptes/compte-seed");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const resultat_de_l_exercice_1 = require("./resultat-de-l-exercice");
const BILAN_ACTIF_OFFICIEL = [
    ['GA', 'Immobilisations (1)', '1'],
    ['GB', 'Stocks', '2'],
    ['GC', 'Adhérents, clients-usagers et autres débiteurs', '3'],
    ['GD', 'Caisse', '4'],
    ['GE', 'Banque (en + ou en -)', '4'],
];
const BILAN_PASSIF_OFFICIEL = [
    ['HA', 'Dotations', '5'],
    ['HC', 'Autres fonds propres', null],
    ['HD', 'Fournisseurs et autres créditeurs', '3'],
];
const RECETTES_OFFICIEL = [
    ['KA', 'Revenus encaissés'],
    ['KB', 'Autres recettes sur activités'],
];
const DEPENSES_OFFICIEL = [
    ['JA', 'Dépenses sur achats'],
    ['JB', 'Dépenses sur loyers'],
    ['JC', 'Dépenses sur salaires'],
    ['JD', 'Dépenses sur impôts et taxes'],
    ['JE', "Charges d'intérêts"],
    ['JF', 'Autres dépenses sur activités'],
];
const COMPTES_IMPUTATION = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL');
function capte(poste, numero) {
    return (poste.comptes.some((p) => numero.startsWith(p)) && !(poste.exclusions ?? []).some((e) => numero.startsWith(e)));
}
describe('correspondance SMT · conformité à la maquette officielle', () => {
    it('le bilan reprend les REF, libellés et renvois de notes du texte', () => {
        expect(correspondance_smt_1.POSTES_BILAN_ACTIF.map((p) => [p.ref, p.libelle, p.note])).toEqual(BILAN_ACTIF_OFFICIEL);
        expect(correspondance_smt_1.POSTES_BILAN_PASSIF.map((p) => [p.ref, p.libelle, p.note])).toEqual(BILAN_PASSIF_OFFICIEL);
    });
    it('HB (résultat net) n’est PAS un poste de rattachement · il se calcule', () => {
        expect(correspondance_smt_1.POSTES_BILAN_PASSIF.map((p) => p.ref)).not.toContain('HB');
        expect(correspondance_smt_1.ORDRE_BILAN_PASSIF).toContain('HB');
    });
    it('l’ordre d’affichage couvre les postes puis le total, rien de plus', () => {
        expect(correspondance_smt_1.ORDRE_BILAN_ACTIF).toEqual([...correspondance_smt_1.POSTES_BILAN_ACTIF.map((p) => p.ref), 'GZ']);
        expect(correspondance_smt_1.ORDRE_BILAN_PASSIF).toEqual(['HA', 'HB', 'HC', 'HD', 'HZ']);
    });
    it('GZ et HZ somment exactement les postes de leur côté', () => {
        expect(correspondance_smt_1.TOTAUX_BILAN_ACTIF[0].deRefs).toEqual(['GA', 'GB', 'GC', 'GD', 'GE']);
        expect(correspondance_smt_1.TOTAUX_BILAN_PASSIF[0].deRefs).toEqual(['HA', 'HB', 'HC', 'HD']);
    });
    it('le compte de résultat reprend KA-KB puis JA-JF, dans l’ordre du texte', () => {
        expect(correspondance_smt_1.POSTES_RECETTES.map((p) => [p.ref, p.libelle])).toEqual(RECETTES_OFFICIEL);
        expect(correspondance_smt_1.POSTES_DEPENSES.map((p) => [p.ref, p.libelle])).toEqual(DEPENSES_OFFICIEL);
    });
    it('les quatre retraitements portent les signes que la maquette imprime', () => {
        expect(correspondance_smt_1.RETRAITEMENTS.map((r) => [r.ref, r.signe])).toEqual([
            ['VA', 1],
            ['VB', 1],
            ['VC', -1],
            ['JG', -1],
        ]);
    });
    it('chaque compte de détail du plan semé appartient à une catégorie de l’art. 6 au plus', () => {
        const doubles = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL')
            .map((c) => ({ numero: c.numero, categories: correspondance_smt_1.CATEGORIES_RESSOURCES_ART6.filter((k) => (0, etats_financiers_communs_1.correspond)(c.numero, k.comptes, k.exclusions)).map((k) => k.cle) }))
            .filter((c) => c.categories.length > 1);
        expect(doubles).toEqual([]);
    });
    it('porte les cinq notes du SMT et le seuil de l’art. 6', () => {
        expect(correspondance_smt_1.NOTES_SMT).toHaveLength(5);
        expect(correspondance_smt_1.SEUIL_SMT_FCFA).toBe(30_000_000);
        expect(correspondance_smt_1.CATEGORIES_RESSOURCES_ART6.length).toBeGreaterThan(0);
    });
});
describe('correspondance SMT · discipline de la dérivation', () => {
    it('chaque poste dit POURQUOI il capte ces comptes-là', () => {
        for (const p of [...correspondance_smt_1.POSTES_BILAN_ACTIF, ...correspondance_smt_1.POSTES_BILAN_PASSIF, ...correspondance_smt_1.POSTES_RECETTES, ...correspondance_smt_1.POSTES_DEPENSES]) {
            expect([p.ref, (p.fondement ?? '').length > 40]).toEqual([p.ref, true]);
        }
        for (const r of correspondance_smt_1.RETRAITEMENTS) {
            expect([r.ref, r.fondement.length > 40]).toEqual([r.ref, true]);
        }
    });
    it('chaque préfixe cité correspond à au moins un compte du semis SYCEBNL', () => {
        const tous = [...correspondance_smt_1.POSTES_BILAN_ACTIF, ...correspondance_smt_1.POSTES_BILAN_PASSIF, ...correspondance_smt_1.POSTES_RECETTES, ...correspondance_smt_1.POSTES_DEPENSES];
        for (const p of tous) {
            for (const prefixe of p.comptes) {
                expect([p.ref, prefixe, COMPTES_IMPUTATION.some((c) => c.numero.startsWith(prefixe))]).toEqual([
                    p.ref,
                    prefixe,
                    true,
                ]);
            }
        }
    });
    it('la Caisse est le 57 et la Banque tout le reste de la classe 5', () => {
        const gd = correspondance_smt_1.POSTES_BILAN_ACTIF.find((p) => p.ref === 'GD');
        const ge = correspondance_smt_1.POSTES_BILAN_ACTIF.find((p) => p.ref === 'GE');
        expect(gd.comptes).toEqual(['57']);
        expect(ge.comptes).toEqual(['5']);
        expect(ge.exclusions).toEqual(['57']);
        const tresorerie = COMPTES_IMPUTATION.filter((c) => c.numero.startsWith('5'));
        for (const c of tresorerie) {
            const dansGd = capte(gd, c.numero);
            const dansGe = capte(ge, c.numero);
            expect([c.numero, dansGd !== dansGe]).toEqual([c.numero, true]);
        }
    });
    it('aucun compte du semis n’est capté par deux postes du MÊME côté du bilan', () => {
        for (const [nom, postes] of [
            ['actif', correspondance_smt_1.POSTES_BILAN_ACTIF],
            ['passif', correspondance_smt_1.POSTES_BILAN_PASSIF],
        ]) {
            const vus = new Map();
            for (const p of postes) {
                for (const c of COMPTES_IMPUTATION) {
                    if (!capte(p, c.numero))
                        continue;
                    const deja = vus.get(c.numero);
                    if (deja && !(p.sens_qualificatif && postes.find((x) => x.ref === deja)?.sens_qualificatif)) {
                        expect([nom, c.numero, `${deja}/${p.ref}`]).toEqual([nom, c.numero, 'aucun doublon']);
                    }
                    vus.set(c.numero, p.ref);
                }
            }
        }
    });
    it('chaque compte de la classe 1 va à HA, à HB ou à HC, et à un seul · 130 compris', () => {
        const ha = correspondance_smt_1.POSTES_BILAN_PASSIF.find((p) => p.ref === 'HA');
        const hc = correspondance_smt_1.POSTES_BILAN_PASSIF.find((p) => p.ref === 'HC');
        const classe1 = [...COMPTES_IMPUTATION.filter((c) => c.numero.startsWith('1')).map((c) => c.numero), '13010000'];
        const orphelins = classe1.filter((n) => [capte(ha, n), (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(n), capte(hc, n)].filter(Boolean).length !== 1);
        expect(orphelins).toEqual([]);
        expect(capte(hc, '13010000')).toBe(true);
        for (const n of ['13100000', '13900000'])
            expect(capte(hc, n)).toBe(false);
    });
    it('les postes de tiers portent un qualificatif de sens des DEUX côtés', () => {
        const gc = correspondance_smt_1.POSTES_BILAN_ACTIF.find((p) => p.ref === 'GC');
        const hd = correspondance_smt_1.POSTES_BILAN_PASSIF.find((p) => p.ref === 'HD');
        expect(gc.comptes).toEqual(['4']);
        expect(hd.comptes).toEqual(['4']);
        expect(gc.sens_qualificatif).toBe('DEBITEUR');
        expect(hd.sens_qualificatif).toBe('CREDITEUR');
    });
    it('les dépréciations 490 à 498 vont en déduction de GC quel que soit leur signe, le 499 reste une dette', () => {
        const gc = correspondance_smt_1.POSTES_BILAN_ACTIF.find((p) => p.ref === 'GC');
        const hd = correspondance_smt_1.POSTES_BILAN_PASSIF.find((p) => p.ref === 'HD');
        const comptes49 = COMPTES_IMPUTATION.filter((c) => c.numero.startsWith('49')).map((c) => c.numero);
        expect(comptes49.length).toBeGreaterThan(8);
        for (const n of comptes49) {
            const enDeduction = (0, etats_financiers_communs_1.correspond)(n, gc.comptesSansFiltreDeSens ?? []);
            const provision = n.startsWith('499');
            expect([n, enDeduction]).toEqual([n, !provision]);
            expect([n, capte(hd, n)]).toEqual([n, provision]);
        }
    });
    it('les fondements disent ce que les fiches des comptes disent (passe R6)', () => {
        const ka = correspondance_smt_1.POSTES_RECETTES.find((p) => p.ref === 'KA');
        expect(ka.fondement).toContain('renvoie au 71, donc en KB');
        const ha = correspondance_smt_1.POSTES_BILAN_PASSIF.find((p) => p.ref === 'HA');
        expect(ha.fondement).toContain("elle n'en ouvre aucune pour le 106");
        const vc = correspondance_smt_1.RETRAITEMENTS.find((r) => r.ref === 'VC');
        expect(vc.fondement).toContain("hors le 481 « Fournisseurs d'investissements »");
    });
    it('les postes résiduels ramassent exactement ce que les autres laissent', () => {
        const kb = correspondance_smt_1.POSTES_RECETTES.find((p) => p.ref === 'KB');
        const nommesRecettes = correspondance_smt_1.POSTES_RECETTES.filter((p) => p.ref !== 'KB').flatMap((p) => p.comptes);
        expect([...(kb.exclusions ?? [])].sort()).toEqual([...nommesRecettes, ...correspondance_smt_1.DETTES_HORS_EXPLOITATION].sort());
        const jf = correspondance_smt_1.POSTES_DEPENSES.find((p) => p.ref === 'JF');
        const nommesDepenses = correspondance_smt_1.POSTES_DEPENSES.filter((p) => p.ref !== 'JF').flatMap((p) => p.comptes);
        expect([...(jf.exclusions ?? [])].sort()).toEqual([...nommesDepenses, ...correspondance_smt_1.DETTES_HORS_EXPLOITATION].sort());
    });
    it('aucun poste du compte de résultat ne capte un apport, une immobilisation ou le 481 (constat B2)', () => {
        for (const numero of ['10110000', '16500000', '18110000', '24410000', '24510000', '48120000']) {
            const captes = [...correspondance_smt_1.POSTES_RECETTES, ...correspondance_smt_1.POSTES_DEPENSES].filter((p) => (0, etats_financiers_communs_1.correspond)(numero, p.comptes, p.exclusions)).map((p) => p.ref);
            expect({ numero, captes }).toEqual({ numero, captes: [] });
        }
        expect((0, etats_financiers_communs_1.correspond)('41100000', correspondance_smt_1.POSTES_RECETTES.find((p) => p.ref === 'KA').comptes, correspondance_smt_1.POSTES_RECETTES.find((p) => p.ref === 'KA').exclusions)).toBe(true);
        expect((0, etats_financiers_communs_1.correspond)('40110000', correspondance_smt_1.POSTES_DEPENSES.find((p) => p.ref === 'JF').comptes, correspondance_smt_1.POSTES_DEPENSES.find((p) => p.ref === 'JF').exclusions)).toBe(true);
    });
    it('la ventilation de la Note 4 ne recoupe pas les postes du compte de résultat', () => {
        expect(correspondance_smt_1.VENTILATION_RECETTES.map((v) => v.cle)).not.toEqual(correspondance_smt_1.POSTES_RECETTES.map((p) => p.ref));
        expect(correspondance_smt_1.VENTILATION_DEPENSES.length).toBeGreaterThan(0);
        const autresRecettes = correspondance_smt_1.VENTILATION_RECETTES.find((v) => v.cle === 'autres');
        if (autresRecettes) {
            const nommes = correspondance_smt_1.VENTILATION_RECETTES.filter((v) => v.cle !== 'autres').flatMap((v) => v.comptes);
            for (const ex of autresRecettes.exclusions ?? [])
                expect(nommes).toContain(ex);
        }
    });
    it('aucun cadratin dans les libellés ni les fondements (CLAUDE.md §4)', () => {
        for (const p of [...correspondance_smt_1.POSTES_BILAN_ACTIF, ...correspondance_smt_1.POSTES_BILAN_PASSIF, ...correspondance_smt_1.POSTES_RECETTES, ...correspondance_smt_1.POSTES_DEPENSES]) {
            expect(p.libelle).not.toContain('—');
            expect(p.fondement).not.toContain('—');
        }
        for (const r of correspondance_smt_1.RETRAITEMENTS)
            expect(r.libelle).not.toContain('—');
    });
});
//# sourceMappingURL=correspondance-smt.spec.js.map