"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_bilan_1 = require("./correspondance-bilan");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const correspondance_notes_associations_1 = require("../notes-annexes/correspondance-notes-associations");
function postesAmortissementDe(numero) {
    return correspondance_bilan_1.POSTES_ACTIF.filter((p) => p.comptesAmortissement && (0, etats_financiers_communs_1.correspond)(numero, p.comptesAmortissement, p.exclusionsAmortissement)).map((p) => p.ref);
}
describe('correspondance bilan (SYCEBNL, Partie 4 ch. 2)', () => {
    it('ne comporte aucune ref en double, tous postes et totaux confondus', () => {
        const toutesLesRefs = [
            ...correspondance_bilan_1.POSTES_ACTIF.map((p) => p.ref),
            ...correspondance_bilan_1.POSTES_PASSIF.map((p) => p.ref),
            ...correspondance_bilan_1.TOTAUX_ACTIF.map((t) => t.ref),
            ...correspondance_bilan_1.TOTAUX_PASSIF.map((t) => t.ref),
            'CH',
        ];
        expect(new Set(toutesLesRefs).size).toBe(toutesLesRefs.length);
    });
    it("l'ordre d'affichage couvre exactement les postes de détail + totaux, rien de plus, rien de moins", () => {
        const refsActif = new Set([...correspondance_bilan_1.POSTES_ACTIF.map((p) => p.ref), ...correspondance_bilan_1.TOTAUX_ACTIF.map((t) => t.ref)]);
        expect(new Set(correspondance_bilan_1.ORDRE_AFFICHAGE_ACTIF)).toEqual(refsActif);
        const refsPassif = new Set([...correspondance_bilan_1.POSTES_PASSIF.map((p) => p.ref), ...correspondance_bilan_1.TOTAUX_PASSIF.map((t) => t.ref), 'CH']);
        expect(new Set(correspondance_bilan_1.ORDRE_AFFICHAGE_PASSIF)).toEqual(refsPassif);
    });
    it('chaque total ne référence que des refs qui existent réellement (détail ou total imbriqué)', () => {
        const refsConnues = new Set([
            ...correspondance_bilan_1.POSTES_ACTIF.map((p) => p.ref),
            ...correspondance_bilan_1.POSTES_PASSIF.map((p) => p.ref),
            ...correspondance_bilan_1.TOTAUX_ACTIF.map((t) => t.ref),
            ...correspondance_bilan_1.TOTAUX_PASSIF.map((t) => t.ref),
            'CH',
        ]);
        for (const total of [...correspondance_bilan_1.TOTAUX_ACTIF, ...correspondance_bilan_1.TOTAUX_PASSIF]) {
            for (const ref of total.deRefs) {
                expect(refsConnues.has(ref)).toBe(true);
            }
        }
    });
    it('un total ne référence jamais une ref qui vient APRÈS lui dans sa propre liste · sinon le calcul en une passe casserait', () => {
        const dejaResolues = new Set([...correspondance_bilan_1.POSTES_ACTIF.map((p) => p.ref), ...correspondance_bilan_1.POSTES_PASSIF.map((p) => p.ref), 'CH']);
        for (const total of [...correspondance_bilan_1.TOTAUX_ACTIF, ...correspondance_bilan_1.TOTAUX_PASSIF]) {
            for (const ref of total.deRefs) {
                expect(dejaResolues.has(ref)).toBe(true);
            }
            dejaResolues.add(total.ref);
        }
    });
    it('BE (créances) et DI (dettes) portent un qualificatif de sens opposé sur les mêmes préfixes de tiers polyvalents', () => {
        const be = correspondance_bilan_1.POSTES_ACTIF.find((p) => p.ref === 'BE');
        const di = correspondance_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DI');
        expect(be.sens_qualificatif).toBe('DEBITEUR');
        expect(di.sens_qualificatif).toBe('CREDITEUR');
        expect(be.comptes).not.toContain('41');
        expect(di.comptes).not.toContain('41');
    });
    it('CJ (provisions réglementées) retient 15, pas 16 · anomalie n° 3', () => {
        const cj = correspondance_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'CJ');
        expect(cj.comptes).toEqual(['15']);
    });
    it('DW couvre 56 EN ENTIER · la restriction à 564/565 perdait 561 et 566 (audit 2026-08-28)', () => {
        const dw = correspondance_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DW');
        expect(dw.comptes).toEqual(['56']);
        expect(correspondance_bilan_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR).toEqual(['52', '53']);
    });
    it('BW transfère ses soldes 52/53 CRÉDITEURS vers DW · sinon un découvert est compté des deux côtés', () => {
        const bw = correspondance_bilan_1.POSTES_ACTIF.find((p) => p.ref === 'BW');
        expect(bw.comptesTransferesSiCrediteur).toEqual(['52', '53']);
        expect(bw.comptesTransferesSiCrediteur).not.toContain('57');
    });
    it('aucun compte BRUT n’est réclamé par DEUX postes d’actif à la fois', () => {
        const vus = new Map();
        for (const p of correspondance_bilan_1.POSTES_ACTIF) {
            for (const c of p.comptes) {
                expect(vus.get(c) ?? p.ref).toBe(p.ref);
                vus.set(c, p.ref);
            }
        }
    });
    it('aucun compte d’AMORTISSEMENT n’est déduit par DEUX postes d’actif à la fois', () => {
        const vus = new Map();
        for (const p of correspondance_bilan_1.POSTES_ACTIF) {
            for (const c of p.comptesAmortissement ?? []) {
                expect(vus.get(c) ?? p.ref).toBe(p.ref);
                vus.set(c, p.ref);
            }
        }
    });
    it('2919, 2939 ET 2949 (les trois comptes « p » du texte officiel) ne sont assignés qu’à UN SEUL poste chacun', () => {
        for (const numero of ['2919', '2939', '2949']) {
            expect({ numero, postes: postesAmortissementDe(`${numero}0000`) }).toEqual({
                numero,
                postes: postesAmortissementDe(`${numero}0000`).slice(0, 1),
            });
            expect(postesAmortissementDe(`${numero}0000`)).toHaveLength(1);
        }
    });
    it('chaque compte « p » va au poste de la même famille que la rubrique de la Note 5F qui le porte', () => {
        const note5F = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === '5F');
        const rubriqueDe = (numero) => note5F.rubriques.find((r) => (r.comptes ?? []).includes(numero))?.libelle;
        for (const [numero, poste] of [
            ['2919', 'AF'],
            ['2949', 'AL'],
        ]) {
            expect({ numero, postes: postesAmortissementDe(`${numero}0000`) }).toEqual({ numero, postes: [poste] });
            expect({ numero, rubrique: rubriqueDe(numero) }).toEqual({
                numero,
                rubrique: correspondance_bilan_1.POSTES_ACTIF.find((p) => p.ref === poste).libelle,
            });
        }
    });
    it('2919 et 2939 (ambiguïté non résolue par le texte officiel) ne sont assignés qu’à UN SEUL poste chacun', () => {
        const postesAvec2919 = correspondance_bilan_1.POSTES_ACTIF.filter((p) => p.comptesAmortissement?.includes('2919'));
        const postesAvec2939 = correspondance_bilan_1.POSTES_ACTIF.filter((p) => p.comptesAmortissement?.includes('2939'));
        expect(postesAvec2919).toHaveLength(1);
        expect(postesAvec2939).toHaveLength(1);
    });
});
//# sourceMappingURL=correspondance-bilan.spec.js.map