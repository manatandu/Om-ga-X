"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_tft_1 = require("./correspondance-tft");
const compte_seed_1 = require("../comptes/compte-seed");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const MODELE_OFFICIEL = [
    { ref: 'ZA', libelle: 'Trésorerie nette au 1er janvier', repere: 'A' },
    { ref: 'FA', libelle: 'Encaissement des cotisations', signe: '+' },
    { ref: 'FB', libelle: "Encaissement des subventions d'exploitation et d'équilibre", signe: '+' },
    { ref: 'FC', libelle: 'Encaissement des revenus liés à la générosité', signe: '+' },
    { ref: 'FD', libelle: 'Encaissement des revenus des manifestations', signe: '+' },
    { ref: 'FE', libelle: 'Encaissement des autres revenus', signe: '+' },
    { ref: 'FF', libelle: 'Décaissement des sommes versées aux fournisseurs', signe: '-' },
    { ref: 'FG', libelle: 'Décaissement des sommes versées au personnel', signe: '-' },
    { ref: 'FH', libelle: 'Autres décaissements', signe: '-' },
    { ref: 'ZB', libelle: 'Flux de trésorerie provenant des activités opérationnelles', repere: 'B' },
    { ref: 'FI', libelle: "Décaissements liés aux acquisitions d'immobilisations incorporelles et corporelles", signe: '-' },
    { ref: 'FJ', libelle: "Décaissements liés aux acquisitions d'immobilisations financières", signe: '-' },
    { ref: 'FK', libelle: "Encaissements liés aux cessions d'immobilisations incorporelles et corporelles", signe: '+' },
    { ref: 'FL', libelle: "Encaissements liés aux cessions d'immobilisations financières", signe: '+' },
    { ref: 'ZC', libelle: "Flux de trésorerie provenant des activités d'investissement", repere: 'C' },
    { ref: 'FM', libelle: 'Encaissement des dotations et autres fonds propres', signe: '+' },
    { ref: 'FN', libelle: "Subventions d'investissement reçues", signe: '+' },
    { ref: 'FO', libelle: 'Décaissement des dotations et autres fonds propres', signe: '-' },
    { ref: 'ZD', libelle: 'Flux de trésorerie provenant des fonds propres', repere: 'D' },
    { ref: 'FP', libelle: 'Encaissement provenant des emprunts et des autres dettes financières', signe: '+' },
    { ref: 'FQ', libelle: 'Remboursements des emprunts et autres dettes financières', signe: '-' },
    { ref: 'ZE', libelle: 'Trésorerie provenant des fonds étrangers', repere: 'E' },
    { ref: '', libelle: 'Flux de trésorerie provenant des activités de financement (D+E)' },
    { ref: 'ZF', libelle: 'VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE', repere: 'G' },
    { ref: 'ZG', libelle: 'Trésorerie nette au 31 Décembre', repere: 'H' },
];
const COMPTES_IMPUTATION = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL');
function existeAuPlan(prefixe) {
    return COMPTES_IMPUTATION.some((c) => c.numero.startsWith(prefixe));
}
describe('correspondance TFT SYCEBNL · confrontation au modèle officiel', () => {
    it("l'ordre d'affichage reprend EXACTEMENT les codes du modèle, dans l'ordre du texte", () => {
        const refsAffichees = correspondance_tft_1.ORDRE_AFFICHAGE_FLUX.filter((e) => 'ref' in e).map((e) => e.ref);
        expect(refsAffichees).toEqual(MODELE_OFFICIEL.map((m) => m.ref));
    });
    it('intercale les quatre en-têtes de section du modèle, aux bons endroits', () => {
        const sections = correspondance_tft_1.ORDRE_AFFICHAGE_FLUX.filter((e) => 'section' in e);
        expect(sections).toHaveLength(4);
        const positionsSections = correspondance_tft_1.ORDRE_AFFICHAGE_FLUX.map((e, i) => ('section' in e ? i : -1)).filter((i) => i >= 0);
        const positionZA = correspondance_tft_1.ORDRE_AFFICHAGE_FLUX.findIndex((e) => 'ref' in e && e.ref === 'ZA');
        expect(positionsSections[0]).toBe(positionZA + 1);
    });
    it('ne comporte aucune ref en double, postes et totaux confondus', () => {
        const refs = [...correspondance_tft_1.TOUS_LES_POSTES_FLUX.map((p) => p.ref), ...correspondance_tft_1.TOTAUX_FLUX.map((t) => t.ref)].filter((r) => r !== '');
        expect(new Set(refs).size).toBe(refs.length);
    });
    it('les vingt et un libellés de postes reprennent ceux du modèle', () => {
        for (const attendu of MODELE_OFFICIEL.filter((m) => m.ref.startsWith('F'))) {
            const poste = (0, correspondance_tft_1.trouvePosteFlux)(attendu.ref);
            expect(poste).toBeDefined();
            expect(poste.libelle).toBe(attendu.libelle);
        }
    });
    it('le SENS de chaque poste suit le signe du modèle · un sens inversé ne casse rien et fausse tout', () => {
        for (const attendu of MODELE_OFFICIEL.filter((m) => m.signe)) {
            const poste = (0, correspondance_tft_1.trouvePosteFlux)(attendu.ref);
            expect([attendu.ref, poste.sens]).toEqual([
                attendu.ref,
                attendu.signe === '+' ? 'ENCAISSEMENT' : 'DECAISSEMENT',
            ]);
        }
    });
    it('porte les repères A à H du modèle, F compris dans son absence', () => {
        const reperes = correspondance_tft_1.TOTAUX_FLUX.map((t) => t.repere).filter(Boolean);
        expect(reperes).toEqual(['B', 'C', 'D', 'E', 'G']);
        expect(reperes).not.toContain('F');
    });
    it('ZF somme bien B + C + D + E, comme l’écrit le modèle', () => {
        const zf = correspondance_tft_1.TOTAUX_FLUX.find((t) => t.ref === 'ZF');
        expect(zf.deRefs).toEqual(['ZB', 'ZC', 'ZD', 'ZE']);
    });
    it('chaque total ne somme que les postes de SON bloc, ni plus ni moins', () => {
        const attendus = [
            ['ZB', correspondance_tft_1.POSTES_OPERATIONNELS.map((p) => p.ref)],
            ['ZC', correspondance_tft_1.POSTES_INVESTISSEMENT.map((p) => p.ref)],
            ['ZD', correspondance_tft_1.POSTES_FONDS_PROPRES.map((p) => p.ref)],
            ['ZE', correspondance_tft_1.POSTES_FONDS_ETRANGERS.map((p) => p.ref)],
        ];
        for (const [ref, postes] of attendus) {
            expect(correspondance_tft_1.TOTAUX_FLUX.find((t) => t.ref === ref).deRefs).toEqual(postes);
        }
    });
    it('un total ne référence jamais une ref définie APRÈS lui · le calcul en une passe lirait 0', () => {
        const rangDefinition = new Map();
        correspondance_tft_1.TOUS_LES_POSTES_FLUX.forEach((p, i) => rangDefinition.set(p.ref, i));
        correspondance_tft_1.TOTAUX_FLUX.forEach((t, i) => rangDefinition.set(t.ref, 1000 + i));
        correspondance_tft_1.TOTAUX_FLUX.forEach((t, i) => {
            for (const de of t.deRefs) {
                expect([t.ref, de, rangDefinition.get(de) < 1000 + i]).toEqual([t.ref, de, true]);
            }
        });
    });
});
describe('correspondance TFT SYCEBNL · cohérence avec le plan de comptes', () => {
    it('chaque préfixe cité correspond à au moins un compte d’imputation du semis', () => {
        for (const p of correspondance_tft_1.TOUS_LES_POSTES_FLUX) {
            for (const prefixe of [
                ...p.comptesFlux,
                ...(p.comptesContrepartie ?? []),
                ...(p.creditsARetrancher ?? []).flatMap((r) => r.comptes),
            ]) {
                expect([p.ref, prefixe, existeAuPlan(prefixe)]).toEqual([p.ref, prefixe, true]);
            }
        }
    });
    it('chaque exclusion porte sur un préfixe que le poste capte réellement', () => {
        for (const p of correspondance_tft_1.TOUS_LES_POSTES_FLUX) {
            for (const ex of p.exclusionsFlux ?? []) {
                expect([p.ref, ex, p.comptesFlux.some((c) => ex.startsWith(c))]).toEqual([p.ref, ex, true]);
            }
            for (const ex of p.exclusionsContrepartie ?? []) {
                expect([p.ref, ex, (p.comptesContrepartie ?? []).some((c) => ex.startsWith(c))]).toEqual([p.ref, ex, true]);
            }
        }
    });
    it('deux postes ne captent le même compte que par des lectures DISJOINTES', () => {
        const disjointes = (a, b) => (a === 'DEBIT_SEUL' && b === 'CREDIT_SEUL') || (a === 'CREDIT_SEUL' && b === 'DEBIT_SEUL');
        for (const [nom, postes] of [
            ['opérationnels', correspondance_tft_1.POSTES_OPERATIONNELS],
            ['investissement', correspondance_tft_1.POSTES_INVESTISSEMENT],
            ['fonds propres', correspondance_tft_1.POSTES_FONDS_PROPRES],
            ['fonds étrangers', correspondance_tft_1.POSTES_FONDS_ETRANGERS],
        ]) {
            const vus = new Map();
            for (const p of postes) {
                for (const c of COMPTES_IMPUTATION) {
                    const capte = p.comptesFlux.some((pref) => c.numero.startsWith(pref)) &&
                        !(p.exclusionsFlux ?? []).some((ex) => c.numero.startsWith(ex));
                    if (!capte)
                        continue;
                    const deja = vus.get(c.numero);
                    if (deja) {
                        expect([nom, c.numero, `${deja.ref}/${p.ref}`, disjointes(deja.lecture, p.lectureFlux)]).toEqual([
                            nom,
                            c.numero,
                            `${deja.ref}/${p.ref}`,
                            true,
                        ]);
                    }
                    vus.set(c.numero, { ref: p.ref, lecture: p.lectureFlux });
                }
            }
        }
    });
    it('la lecture d’un poste correspond à ce qu’il enregistre', () => {
        expect((0, correspondance_tft_1.trouvePosteFlux)('FI').lectureFlux).toBe('DEBIT_SEUL');
        expect((0, correspondance_tft_1.trouvePosteFlux)('FJ').lectureFlux).toBe('DEBIT_SEUL');
        expect((0, correspondance_tft_1.trouvePosteFlux)('FM').lectureFlux).toBe('CREDIT_SEUL');
        expect((0, correspondance_tft_1.trouvePosteFlux)('FN').lectureFlux).toBe('CREDIT_SEUL');
        expect((0, correspondance_tft_1.trouvePosteFlux)('FP').lectureFlux).toBe('CREDIT_SEUL');
        expect((0, correspondance_tft_1.trouvePosteFlux)('FQ').lectureFlux).toBe('DEBIT_SEUL');
    });
    it('les postes d’encaissement de revenus portent une contrepartie de créance', () => {
        for (const ref of ['FA', 'FB', 'FC', 'FE']) {
            const p = (0, correspondance_tft_1.trouvePosteFlux)(ref);
            expect([ref, (p.comptesContrepartie ?? []).length > 0]).toEqual([ref, true]);
            for (const c of p.comptesContrepartie)
                expect([ref, c.startsWith('4')]).toEqual([ref, true]);
        }
    });
    it('les autres moitiés sans trésorerie que le plan décrit sont neutralisées (passe R6)', () => {
        expect((0, etats_financiers_communs_1.correspond)('10490000', (0, correspondance_tft_1.trouvePosteFlux)('FO').comptesFlux, (0, correspondance_tft_1.trouvePosteFlux)('FO').exclusionsFlux)).toBe(false);
        expect((0, etats_financiers_communs_1.correspond)('16790000', (0, correspondance_tft_1.trouvePosteFlux)('FO').comptesFlux, (0, correspondance_tft_1.trouvePosteFlux)('FO').exclusionsFlux)).toBe(false);
        const fi = (0, correspondance_tft_1.trouvePosteFlux)('FI');
        const retranches = (fi.creditsARetrancher ?? []).flatMap((r) => r.comptes);
        expect(retranches).toEqual(['239', '249', '25', '721', '722']);
        for (const r of [...(fi.creditsARetrancher ?? []), ...((0, correspondance_tft_1.trouvePosteFlux)('FO').creditsARetrancher ?? [])]) {
            expect(r.fondement).toMatch(/Fiches? d(u|es) COMPTES? \d\d/);
        }
    });
    it('le 16 (fonds affectés) est un fonds PROPRE · FM et FO, jamais FP ni FQ (anomalie n° 11, Q1 des cas chiffrés de la clôture)', () => {
        const capteFlux = (ref, numero) => (0, etats_financiers_communs_1.correspond)(numero, (0, correspondance_tft_1.trouvePosteFlux)(ref).comptesFlux, (0, correspondance_tft_1.trouvePosteFlux)(ref).exclusionsFlux);
        for (const numero of ['16500000', '16710000', '16800000']) {
            expect({ numero, FM: capteFlux('FM', numero), FO: capteFlux('FO', numero), FP: capteFlux('FP', numero), FQ: capteFlux('FQ', numero) }).toEqual({
                numero,
                FM: true,
                FO: true,
                FP: false,
                FQ: false,
            });
        }
        expect({ FP: capteFlux('FP', '18110000'), FQ: capteFlux('FQ', '18110000'), FM: capteFlux('FM', '18110000') }).toEqual({ FP: true, FQ: true, FM: false });
        expect(capteFlux('FP', '18600000')).toBe(false);
        expect(((0, correspondance_tft_1.trouvePosteFlux)('FO').creditsARetrancher ?? []).flatMap((r) => r.comptes)).toEqual(['792']);
        expect((0, correspondance_tft_1.trouvePosteFlux)('FQ').creditsARetrancher ?? []).toEqual([]);
    });
    it('les subdivisions du 413 et du 419 suivent la nature de tiers que la fiche du COMPTE 41 leur donne', () => {
        const fa = (0, correspondance_tft_1.trouvePosteFlux)('FA');
        const fe = (0, correspondance_tft_1.trouvePosteFlux)('FE');
        const capte = (p, n) => (0, etats_financiers_communs_1.correspond)(n, p.comptesContrepartie, p.exclusionsContrepartie);
        for (const adherent of ['41310000', '41330000', '41910000']) {
            expect({ adherent, FA: capte(fa, adherent), FE: capte(fe, adherent) }).toEqual({ adherent, FA: true, FE: false });
        }
        for (const usager of ['41320000', '41380000', '41920000', '41940000', '41980000']) {
            expect({ usager, FA: capte(fa, usager), FE: capte(fe, usager) }).toEqual({ usager, FA: false, FE: true });
        }
    });
    it('aucun cadratin dans les libellés ni les notes (CLAUDE.md §4)', () => {
        for (const p of correspondance_tft_1.TOUS_LES_POSTES_FLUX) {
            expect(p.libelle).not.toContain('—');
            if (p.note)
                expect(p.note).not.toContain('—');
        }
        for (const t of correspondance_tft_1.TOTAUX_FLUX)
            expect(t.libelle).not.toContain('—');
    });
});
//# sourceMappingURL=correspondance-tft.spec.js.map