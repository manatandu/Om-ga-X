"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_bilan_syscohada_1 = require("./correspondance-bilan-syscohada");
const MODELE_CH3_ACTIF = [
    'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AP', 'AQ', 'AR', 'AS', 'AZ',
    'BA', 'BB', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BZ',
];
const MODELE_CH3_PASSIF = [
    'CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM', 'CP',
    'DA', 'DB', 'DC', 'DD', 'DF', 'DH', 'DI', 'DJ', 'DK', 'DM', 'DN', 'DP', 'DQ', 'DR', 'DT', 'DV', 'DZ',
];
const NOTES_MODELE_CH3 = {
    AD: '3', AI: '3', AP: '3', AQ: '4', BA: '5', BB: '6', BH: '17', BI: '7', BJ: '8', BQ: '9', BR: '10', BS: '11', BU: '12',
    CA: '13', CB: '13', CD: '14', CE: '3e', CF: '14', CG: '14', CH: '14', CL: '15', CM: '15',
    DA: '16', DB: '16', DC: '16', DH: '5', DI: '7', DJ: '17', DK: '18', DM: '19', DN: '19', DQ: '20', DR: '20', DV: '12',
};
const COMPTES_BILAN_SEMIS = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL' && /^[1-5]/.test(c.numero));
function prefixesCites() {
    const out = [];
    for (const p of [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA]) {
        p.comptes.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'comptes' }));
        p.exclusions?.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'exclusions' }));
        p.comptesAmortissement?.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'comptesAmortissement' }));
        p.exclusionsAmortissement?.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'exclusionsAmortissement' }));
        p.comptesTransferesSiCrediteur?.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'comptesTransferesSiCrediteur' }));
    }
    correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA.forEach((c) => out.push({ prefixe: c, ref: 'DR', role: 'tresoreriePassif' }));
    correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA.forEach((c) => out.push({ prefixe: c, ref: 'CJ', role: 'resultat' }));
    correspondance_bilan_syscohada_1.COMPTES_BILAN_SANS_POSTE_JUSTIFIES.forEach((c) => out.push({ prefixe: c.prefixe, ref: 'orphelin', role: 'sansPoste' }));
    correspondance_bilan_syscohada_1.COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE.forEach((c) => out.push({ prefixe: c.prefixe, ref: 'aSolder', role: 'aSolderALaCloture' }));
    return out;
}
function estCapte(numero) {
    for (const p of [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA]) {
        if ((0, etats_financiers_communs_1.correspond)(numero, p.comptes, p.exclusions))
            return true;
        if (p.comptesAmortissement && (0, etats_financiers_communs_1.correspond)(numero, p.comptesAmortissement, p.exclusionsAmortissement))
            return true;
    }
    return (0, etats_financiers_communs_1.correspond)(numero, correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA) || (0, etats_financiers_communs_1.correspond)(numero, correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA);
}
describe('correspondance bilan SYSCOHADA (AUDCIF Titre IX ch. 3 et ch. 7)', () => {
    it("l'ordre d'affichage reprend EXACTEMENT les codes du modèle du ch. 3, dans l'ordre du texte", () => {
        expect(correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_ACTIF_SYSCOHADA).toEqual(MODELE_CH3_ACTIF);
        expect(correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_PASSIF_SYSCOHADA).toEqual(MODELE_CH3_PASSIF);
    });
    it('ne comporte aucune ref en double, postes, totaux et résultat confondus', () => {
        const toutes = [
            ...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.map((p) => p.ref),
            ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.map((p) => p.ref),
            ...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA.map((t) => t.ref),
            ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA.map((t) => t.ref),
            correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA,
        ];
        expect(new Set(toutes).size).toBe(toutes.length);
    });
    it("l'ordre d'affichage couvre les postes de détail + totaux + CJ, rien de plus, rien de moins", () => {
        const refsActif = new Set([...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.map((p) => p.ref), ...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA.map((t) => t.ref)]);
        expect(new Set(correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_ACTIF_SYSCOHADA)).toEqual(refsActif);
        const refsPassif = new Set([
            ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.map((p) => p.ref),
            ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA.map((t) => t.ref),
            correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA,
        ]);
        expect(new Set(correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_PASSIF_SYSCOHADA)).toEqual(refsPassif);
    });
    it('CJ (résultat) et DR (trésorerie passif) sont bien les refs annoncées, CJ hors POSTES_PASSIF, DR dedans', () => {
        expect(correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA).toBe('CJ');
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('CJ')).toBeUndefined();
        expect(correspondance_bilan_syscohada_1.REF_TRESORERIE_PASSIF_SYSCOHADA).toBe('DR');
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('DR')?.comptes).toEqual(['561', '566']);
        expect(correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA).toEqual(['52', '53']);
    });
    it('chaque total ne référence que des refs qui existent (détail, total imbriqué ou CJ)', () => {
        const connues = new Set([
            ...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.map((p) => p.ref),
            ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.map((p) => p.ref),
            ...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA.map((t) => t.ref),
            ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA.map((t) => t.ref),
            correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA,
        ]);
        for (const total of [...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA]) {
            for (const ref of total.deRefs)
                expect(connues.has(ref)).toBe(true);
        }
    });
    it('un total ne référence jamais une ref définie APRÈS lui · le calcul en une passe lirait 0 en silence', () => {
        const resolues = new Set([
            ...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.map((p) => p.ref),
            ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.map((p) => p.ref),
            correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA,
        ]);
        for (const total of [...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA]) {
            for (const ref of total.deRefs)
                expect(resolues.has(ref)).toBe(true);
            resolues.add(total.ref);
        }
    });
    it('les deux TOTAL GÉNÉRAL (BZ, DZ) reposent chacun sur toutes les grandes masses, écart de conversion compris', () => {
        expect(correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA.find((t) => t.ref === 'BZ')?.deRefs).toEqual(['AZ', 'BK', 'BT', 'BU']);
        expect(correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA.find((t) => t.ref === 'DZ')?.deRefs).toEqual(['DF', 'DP', 'DT', 'DV']);
        const atteint = (totaux, racine) => {
            const vus = new Set();
            const visite = (ref) => {
                vus.add(ref);
                totaux.find((t) => t.ref === ref)?.deRefs.forEach(visite);
            };
            visite(racine);
            return vus;
        };
        const depuisBZ = atteint(correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, 'BZ');
        for (const p of correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA)
            expect(depuisBZ.has(p.ref)).toBe(true);
        const depuisDZ = atteint(correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA, 'DZ');
        for (const p of correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA)
            expect(depuisDZ.has(p.ref)).toBe(true);
        expect(depuisDZ.has(correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA)).toBe(true);
    });
    it('chaque préfixe de compte cité correspond à au moins un compte d’imputation du semis SYSCOHADA', () => {
        const absents = prefixesCites().filter(({ prefixe }) => !COMPTES_BILAN_SEMIS.some((c) => c.numero.startsWith(prefixe)));
        expect(absents).toEqual([]);
    });
    it('chaque préfixe cité reste dans les classes 1 à 5 · la classe 8 n’apparaît pas au bilan (ch. 7, clés de lecture)', () => {
        for (const { prefixe } of prefixesCites())
            expect(prefixe).toMatch(/^[1-5]/);
    });
    it('aucun compte de bilan du semis ne reste orphelin, hors la liste justifiée · et cette liste est exactement l’ensemble des orphelins', () => {
        const orphelins = COMPTES_BILAN_SEMIS.filter((c) => !estCapte(c.numero)).map((c) => c.numero);
        const justifies = correspondance_bilan_syscohada_1.COMPTES_BILAN_SANS_POSTE_JUSTIFIES.map((j) => j.prefixe);
        const nonJustifies = orphelins.filter((n) => !justifies.some((j) => n.startsWith(j)));
        expect(nonJustifies).toEqual([]);
        const justificationsInutiles = justifies.filter((j) => !orphelins.some((n) => n.startsWith(j)));
        expect(justificationsInutiles).toEqual([]);
        expect(justifies.sort()).toEqual(['186', '187', '188', '585', '588']);
    });
    it('les comptes « à solder à la clôture » existent au plan, et chacun est soit capté par un poste (104 → CA) soit orphelin justifié', () => {
        const orphelinsJustifies = new Set(correspondance_bilan_syscohada_1.COMPTES_BILAN_SANS_POSTE_JUSTIFIES.map((j) => j.prefixe));
        for (const { prefixe } of correspondance_bilan_syscohada_1.COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE) {
            const feuilles = COMPTES_BILAN_SEMIS.filter((c) => c.numero.startsWith(prefixe));
            expect(feuilles.length).toBeGreaterThan(0);
            const capte = feuilles.every((c) => estCapte(c.numero));
            const orphelin = orphelinsJustifies.has(prefixe);
            expect(capte !== orphelin).toBe(true);
        }
        expect(correspondance_bilan_syscohada_1.COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE.map((c) => c.prefixe).sort()).toEqual(['104', '130', '585', '588']);
        expect((0, etats_financiers_communs_1.correspond)('10470000', (0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('CA').comptes)).toBe(true);
    });
    it('aucun compte BRUT n’est réclamé par DEUX postes d’ACTIF à la fois (à sens de solde égal)', () => {
        for (const c of COMPTES_BILAN_SEMIS) {
            const postes = correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions));
            expect(postes.length).toBeLessThanOrEqual(1);
        }
    });
    it('aucun compte d’AMORTISSEMENT/DÉPRÉCIATION n’est déduit par DEUX postes d’actif · anomalie n° 1 (suffixe « p »)', () => {
        for (const c of COMPTES_BILAN_SEMIS) {
            const postes = correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.filter((p) => p.comptesAmortissement && (0, etats_financiers_communs_1.correspond)(c.numero, p.comptesAmortissement, p.exclusionsAmortissement));
            expect(postes.length).toBeLessThanOrEqual(1);
        }
        const posteDe = (numero) => correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(numero, p.comptesAmortissement ?? [], p.exclusionsAmortissement)).map((p) => p.ref);
        expect(posteDe('28180000')).toEqual(['AH']);
        expect(posteDe('29180000')).toEqual(['AH']);
        expect(posteDe('29190000')).toEqual(['AH']);
        expect(posteDe('29390000')).toEqual(['AL']);
        expect(posteDe('29490000')).toEqual(['AM']);
    });
    it('un compte de PASSIF n’est réclamé que par un seul poste de passif', () => {
        for (const c of COMPTES_BILAN_SEMIS) {
            const postes = correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions));
            expect(postes.length).toBeLessThanOrEqual(1);
        }
    });
    it('un compte réclamé à l’ACTIF et au PASSIF porte un qualificatif de sens des DEUX côtés · sinon il serait compté deux fois (anomalie n° 12)', () => {
        const partages = [];
        for (const c of COMPTES_BILAN_SEMIS) {
            const actif = correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions));
            const passif = correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions));
            if (actif.length === 0 || passif.length === 0)
                continue;
            partages.push(c.numero);
            for (const p of actif)
                expect({ numero: c.numero, ref: p.ref, sens: p.sens_qualificatif }).toEqual({ numero: c.numero, ref: p.ref, sens: 'DEBITEUR' });
            for (const p of passif)
                expect({ numero: c.numero, ref: p.ref, sens: p.sens_qualificatif }).toEqual({ numero: c.numero, ref: p.ref, sens: 'CREDITEUR' });
        }
        expect(partages.length).toBeGreaterThan(0);
        const postesDe = (numero) => [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA].filter((p) => (0, etats_financiers_communs_1.correspond)(numero, p.comptes, p.exclusions)).map((p) => p.ref);
        for (const c of COMPTES_BILAN_SEMIS.filter((c) => c.numero.startsWith('478')))
            expect(postesDe(c.numero)).toEqual(['BU']);
        for (const c of COMPTES_BILAN_SEMIS.filter((c) => c.numero.startsWith('479')))
            expect(postesDe(c.numero)).toEqual(['DV']);
        const bs = (0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('BS');
        expect(bs.comptesTransferesSiCrediteur).toEqual(correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA);
        for (const prefixe of correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA) {
            expect(correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.some((p) => p.comptes.some((c) => c.startsWith(prefixe) || prefixe.startsWith(c)))).toBe(false);
        }
    });
    it('les renvois de notes de chaque poste et total reprennent la colonne Note du modèle du ch. 3', () => {
        const lignes = [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA];
        for (const l of lignes)
            expect({ ref: l.ref, note: l.note }).toEqual({ ref: l.ref, note: NOTES_MODELE_CH3[l.ref] });
        for (const ref of Object.keys(NOTES_MODELE_CH3))
            expect(lignes.some((l) => l.ref === ref)).toBe(true);
    });
    it('BJ (créances) porte « débiteur », DK et DM (dettes) portent « créditeur », sur des préfixes disjoints entre DK et DM', () => {
        const bj = (0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('BJ');
        const dk = (0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('DK');
        const dm = (0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('DM');
        expect(bj.sens_qualificatif).toBe('DEBITEUR');
        expect(dk.sens_qualificatif).toBe('CREDITEUR');
        expect(dm.sens_qualificatif).toBe('CREDITEUR');
        expect([...dk.comptes, ...dm.comptes].sort()).toEqual([...bj.comptes].sort());
        expect(dk.comptes.filter((c) => dm.comptes.includes(c))).toEqual([]);
        expect(bj.exclusions).toEqual(['478', '479']);
        expect(dm.exclusions).toEqual(['478', '479']);
        expect(bj.comptes).not.toContain('41');
        expect(dm.comptes).not.toContain('41');
    });
    it('les clauses « sauf » du ch. 7 renvoient chacune vers le poste qui reçoit le compte retiré', () => {
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('DJ').exclusions).toEqual(['409']);
        expect((0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('BH').comptes).toEqual(['409']);
        expect((0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('BI').exclusions).toEqual(['419']);
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('DI').comptes).toEqual(['419']);
        expect((0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('AH').exclusions).toEqual(['2181']);
        expect((0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('AE').comptes).toContain('2181');
        expect((0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('AM').exclusions).toEqual(['245', '2495']);
        expect((0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('AN').comptes).toEqual(['245', '2495']);
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('DN').exclusions).toEqual(['4998']);
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('DH').comptes).toContain('4998');
    });
    it('BS transfère ses 52/53 CRÉDITEURS vers DR et garde 54/55/57/581/582 visibles · anomalie n° 3', () => {
        const bs = (0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('BS');
        expect(bs.comptesTransferesSiCrediteur).toEqual(['52', '53']);
        expect(bs.sens_qualificatif).toBeUndefined();
        expect(bs.comptes).toEqual(['52', '53', '54', '55', '57', '581', '582']);
        expect(bs.comptes).not.toContain('58');
    });
    it('2394, 2395, 2398 (absents du ch. 7) sont rattachés à AL · anomalie n° 2', () => {
        const al = (0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('AL');
        for (const numero of ['23940000', '23950000', '23980000']) {
            expect((0, etats_financiers_communs_1.correspond)(numero, al.comptes, al.exclusions)).toBe(true);
        }
        expect((0, etats_financiers_communs_1.correspond)('23910000', al.comptes, al.exclusions)).toBe(false);
        expect((0, etats_financiers_communs_1.correspond)('23910000', (0, correspondance_bilan_syscohada_1.trouvePosteActifSyscohada)('AK').comptes)).toBe(true);
    });
    it('CB (109) et CH (12) sont des postes de passif ordinaires · leur signe vient du solde, pas d’un traitement spécial', () => {
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('CB').comptes).toEqual(['109']);
        expect((0, correspondance_bilan_syscohada_1.trouvePostePassifSyscohada)('CH').comptes).toEqual(['12']);
        for (const c of COMPTES_BILAN_SEMIS.filter((c) => c.numero.startsWith('13'))) {
            expect(correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.some((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions))).toBe(false);
            expect({ numero: c.numero, cj: (0, etats_financiers_communs_1.correspond)(c.numero, correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA) }).toEqual({ numero: c.numero, cj: true });
        }
        expect(correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA).toEqual(['131', '132', '133', '134', '135', '136', '137', '138', '139', '130']);
        expect(correspondance_bilan_syscohada_1.COMPTES_BILAN_SANS_POSTE_JUSTIFIES.find((j) => j.prefixe === '130')).toBeUndefined();
    });
    it('chaque poste de l’actif a des comptes d’amortissement sauf BU (écart de conversion) · ch. 7, colonne vide', () => {
        for (const p of correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA) {
            if (p.ref === 'BU')
                expect(p.comptesAmortissement).toBeUndefined();
            else
                expect(p.comptesAmortissement?.length).toBeGreaterThan(0);
        }
        for (const p of correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA)
            expect(p.comptesAmortissement).toBeUndefined();
    });
    it('aucun cadratin dans les libellés ni les renvois (CLAUDE.md §4)', () => {
        for (const p of [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA]) {
            expect(p.libelle).not.toMatch(/\u2014/);
        }
    });
});
//# sourceMappingURL=correspondance-bilan-syscohada.spec.js.map