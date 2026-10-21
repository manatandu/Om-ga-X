"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const decompte_final_1 = require("./decompte-final");
const decompte_final_emis_1 = require("./decompte-final-emis");
const BASE = {
    anneesAnciennete: 3,
    moisNonCouvertsParUnConge: 6,
    moinsDeDixHuitAns: false,
    initiative: 'EMPLOYEUR',
    motif: 'LICENCIEMENT',
    typeContrat: 'DUREE_INDETERMINEE',
    executionPreavis: 'DISPENSE_PAR_EMPLOYEUR',
    dateNotification: '2026-05-18',
    remunerationJournaliereFc: 10_000,
    moyenneMensuelleArticle66Fc: 0,
    moyenneMensuelleArticle142Fc: 0,
    avantagesPendantPreavisFc: 0,
    arrieresFc: 0,
    enfantsBeneficiairesAllocations: 0,
};
const STIPULEE = { montantAnnuelFc: 1_200_000, source: 'Contrat de travail, art. 6', debutPeriode: '2027-01-01', finPeriode: '2027-03-31' };
describe('A18 · gratification au prorata, PROPOSÉE seulement si stipulée', () => {
    it("sans stipulation · aucune proposition, le montant reste null et l'émission le refuse (jamais zéro)", () => {
        const v = (0, decompte_final_1.decompteFinal)(BASE);
        expect(v.propositionGratification).toBeNull();
        expect(v.rubriques.find((r) => r.cle === 'gratification')?.montantFc).toBeNull();
        expect((0, decompte_final_emis_1.elementsDuDecompte)(v).refus).toContain(decompte_final_emis_1.MOTIF_GRATIFICATION);
    });
    it("stipulée et non confirmée · proposée (300 000 FC = 1 200 000 × 3 / 12), le total reste null jusqu'à confirmation", () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...BASE, gratificationStipulee: STIPULEE });
        expect(v.propositionGratification).toEqual(expect.objectContaining({ montantFc: 300_000, moisEntiers: 3 }));
        const r = v.rubriques.find((x) => x.cle === 'gratification');
        expect(r?.montantFc).toBeNull();
        expect(r?.reserve?.startsWith(decompte_final_1.PREFIXE_GRATIFICATION_STIPULEE)).toBe(true);
        expect(v.totalBrutFc).toBeNull();
        const { refus } = (0, decompte_final_emis_1.elementsDuDecompte)(v);
        expect(refus.some((m) => m.includes('proposée 300000.00 FC'))).toBe(true);
    });
    it('confirmée · le montant saisi entre au brut sous la nature gratification', () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...BASE, gratificationStipulee: STIPULEE, gratificationFc: 300_000 });
        const { elements, refus } = (0, decompte_final_emis_1.elementsDuDecompte)(v);
        expect(refus).toEqual([]);
        expect(elements.find((e) => e.cleRubrique === 'gratification')).toEqual(expect.objectContaining({ nature: 'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE', montantFc: 300_000 }));
        expect(v.rubriques.find((r) => r.cle === 'gratification')?.reserve).toContain('confirmée sur la proposition');
    });
    it('un montant retenu différent de la proposition est admis, et la différence est dite', () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...BASE, gratificationStipulee: STIPULEE, gratificationFc: 312_000 });
        expect(v.rubriques.find((r) => r.cle === 'gratification')?.montantFc).toBe(312_000);
        expect(v.rubriques.find((r) => r.cle === 'gratification')?.reserve).toContain('diffère de la proposition');
    });
    it("une stipulation sans source refuse la rubrique, même avec un montant saisi · la source est ce qui manque", () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...BASE, gratificationStipulee: { ...STIPULEE, source: '' }, gratificationFc: 300_000 });
        expect(v.rubriques.find((r) => r.cle === 'gratification')?.montantFc).toBeNull();
        expect((0, decompte_final_emis_1.elementsDuDecompte)(v).refus.some((m) => m.includes('source'))).toBe(true);
    });
});
describe('A18 · indemnité de fin de contrat stipulée, recopiée et jamais calculée', () => {
    it('passe sous la nature de fin de contrat (6614), à son montant exact, en plus des sommes légales', () => {
        const sans = (0, decompte_final_1.decompteFinal)({ ...BASE, gratificationFc: 0 });
        const avec = (0, decompte_final_1.decompteFinal)({ ...BASE, gratificationFc: 0, indemniteStipulee: { montantFc: 500_000, source: 'Convention collective, art. 40' } });
        expect(avec.totalBrutFc - sans.totalBrutFc).toBe(500_000);
        const { elements, refus } = (0, decompte_final_emis_1.elementsDuDecompte)(avec);
        expect(refus).toEqual([]);
        expect(elements.find((e) => e.cleRubrique === 'indemnite-stipulee')).toEqual(expect.objectContaining({ nature: 'INDEMNITE_DE_FIN_DE_CONTRAT', montantFc: 500_000 }));
        expect(avec.rubriques.find((r) => r.cle === 'indemnite-stipulee')?.fondement).toContain('Convention collective, art. 40');
    });
    it("absente · aucune rubrique, ce n'est pas un manque", () => {
        expect((0, decompte_final_1.decompteFinal)({ ...BASE, gratificationFc: 0 }).rubriques.some((r) => r.cle === 'indemnite-stipulee')).toBe(false);
    });
    it("sans source · non chiffrée, l'émission refuse", () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...BASE, gratificationFc: 0, indemniteStipulee: { montantFc: 500_000, source: '' } });
        expect(v.totalBrutFc).toBeNull();
        expect((0, decompte_final_emis_1.elementsDuDecompte)(v).refus.some((m) => m.includes('Indemnité de fin de contrat stipulée'))).toBe(true);
    });
});
//# sourceMappingURL=decompte-final-a18.spec.js.map