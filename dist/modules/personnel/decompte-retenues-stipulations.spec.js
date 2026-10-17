"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const decompte_retenues_stipulations_1 = require("./decompte-retenues-stipulations");
const d = (s) => new Date(`${s}T00:00:00Z`);
const AVANCE = { avanceId: 'a1', type: 'AVANCE', dateOctroi: '2026-11-10', libelle: 'Avance du 2026-11-10', soldeFc: 300_000 };
const PRET = { avanceId: 'p1', type: 'PRET', dateOctroi: '2026-03-01', libelle: 'Prêt du 2026-03-01', soldeFc: 450_000.5 };
const SAISIE = { avanceId: 's1', type: 'SAISIE_ARRET', dateOctroi: '2026-05-01', libelle: 'Saisie-arrêt', soldeFc: 90_000 };
describe("A18 · retenues d'avance et de prêt proposées au décompte (Code du travail, art. 112, c et f)", () => {
    it("propose le solde entier quand le net le porte · avances (c) avant prêts (f), plus ancien d'abord", () => {
        const acompte = { avanceId: 'a0', type: 'ACOMPTE', dateOctroi: '2026-12-01', libelle: 'Acompte', soldeFc: 50_000 };
        const p = (0, decompte_retenues_stipulations_1.propositionRetenuesDecompte)([PRET, acompte, AVANCE], 2_000_000);
        expect(p.retenues.map((r) => [r.avanceId, r.littera, r.montantProposeFc])).toEqual([
            ['a1', 'c', 300_000],
            ['a0', 'c', 50_000],
            ['p1', 'f', 450_000.5],
        ]);
        expect(p.resteNonRetenuFc).toBe(0);
        expect(p.retenues.find((r) => r.avanceId === 'p1')?.reserve).toContain(decompte_retenues_stipulations_1.RESERVE_PRET_EXIGIBILITE);
        expect(p.retenues.find((r) => r.avanceId === 'a1')?.reserve).toBeNull();
    });
    it('ne dépasse jamais le net disponible · le reste demeure dû au registre, dit sur la ligne', () => {
        const p = (0, decompte_retenues_stipulations_1.propositionRetenuesDecompte)([AVANCE, PRET], 400_000);
        expect(p.retenues.map((r) => r.montantProposeFc)).toEqual([300_000, 100_000]);
        expect(p.resteNonRetenuFc).toBe(350_000.5);
        expect(p.retenues[1].reserve).toContain('Ramenée de 450000.50 FC à 100000.00 FC');
    });
    it('un net nul ou négatif ne laisse rien à retenir, jamais un net négatif', () => {
        const p = (0, decompte_retenues_stipulations_1.propositionRetenuesDecompte)([AVANCE], -10);
        expect(p.retenues[0].montantProposeFc).toBe(0);
        expect(p.resteNonRetenuFc).toBe(300_000);
    });
    it("net non chiffré · le solde est proposé et la réserve le dit (null n'est pas zéro)", () => {
        const p = (0, decompte_retenues_stipulations_1.propositionRetenuesDecompte)([AVANCE], null);
        expect(p.retenues[0].montantProposeFc).toBe(300_000);
        expect(p.reserves).toContain(decompte_retenues_stipulations_1.RESERVE_NET_NON_CHIFFRE);
    });
    it("la saisie-arrêt n'est jamais proposée · nommée, renvoyée à l'acte", () => {
        const p = (0, decompte_retenues_stipulations_1.propositionRetenuesDecompte)([SAISIE, AVANCE], 1_000_000);
        expect(p.retenues.map((r) => r.avanceId)).toEqual(['a1']);
        expect(p.saisiesNonProposees).toEqual([{ avanceId: 's1', libelle: 'Saisie-arrêt', soldeFc: 90_000 }]);
        expect(p.reserves).toContain(decompte_retenues_stipulations_1.RESERVE_SAISIE_NON_PROPOSEE);
    });
    it('une avance soldée ne propose rien', () => {
        expect((0, decompte_retenues_stipulations_1.propositionRetenuesDecompte)([{ ...AVANCE, soldeFc: 0 }], 1_000).retenues).toEqual([]);
    });
    it("l'émission avertit d'un solde que le décompte ne retient pas, jamais d'une saisie", () => {
        const a = (0, decompte_retenues_stipulations_1.avertissementsSoldesRestants)([AVANCE, PRET, SAISIE], { a1: 300_000, p1: 100_000 });
        expect(a).toHaveLength(1);
        expect(a[0]).toContain('350000.50 FC restent dus');
        expect(a[0]).toContain('art. 112, f');
    });
});
describe('A18 · gratification stipulée, prorata proposé', () => {
    const G = { montantAnnuelFc: 1_200_000, source: 'Contrat, art. 6', debutPeriode: '2027-01-01', finPeriode: '2027-03-31' };
    it('mois entiers date à date · jamais trente jours, jamais un mois entamé', () => {
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-01-01'), d('2027-03-31'))).toBe(3);
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-03-15'), d('2027-04-14'))).toBe(1);
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-03-15'), d('2027-04-13'))).toBe(0);
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-01-31'), d('2027-02-26'))).toBe(0);
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-01-31'), d('2027-02-27'))).toBe(1);
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-01-31'), d('2027-03-30'))).toBe(2);
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-01-01'), d('2027-12-31'))).toBe(12);
        expect((0, decompte_retenues_stipulations_1.moisEntiersDeService)(d('2027-02-01'), d('2027-01-01'))).toBe(0);
    });
    it('propose montant annuel × mois entiers / 12, base dite', () => {
        const p = (0, decompte_retenues_stipulations_1.propositionGratification)(G);
        expect(p).toEqual(expect.objectContaining({ montantFc: 300_000, moisEntiers: 3 }));
        expect(p?.base).toContain('Contrat, art. 6');
        expect(p?.base).toContain('× 3 mois entiers');
    });
    it('arrondit au centime', () => {
        expect((0, decompte_retenues_stipulations_1.propositionGratification)({ ...G, montantAnnuelFc: 1_000_000, finPeriode: '2027-01-31' })?.montantFc).toBe(83_333.33);
    });
    it('sans source, sans montant ou au-delà de douze mois · refus nommé, aucune proposition (jamais zéro inventé)', () => {
        expect((0, decompte_retenues_stipulations_1.motifRefusGratificationStipulee)({ ...G, source: ' ' })).toMatch(/source/);
        expect((0, decompte_retenues_stipulations_1.propositionGratification)({ ...G, source: '' })).toBeNull();
        expect((0, decompte_retenues_stipulations_1.motifRefusGratificationStipulee)({ ...G, montantAnnuelFc: 0 })).toMatch(/positif/);
        expect((0, decompte_retenues_stipulations_1.motifRefusGratificationStipulee)({ ...G, finPeriode: '2028-02-15' })).toMatch(/douze mois/);
        expect((0, decompte_retenues_stipulations_1.motifRefusGratificationStipulee)({ ...G, finPeriode: '2027-02-30' })).toMatch(/illisibles/);
        expect((0, decompte_retenues_stipulations_1.motifRefusGratificationStipulee)({ ...G, finPeriode: '2026-12-31' })).toMatch(/précède/);
    });
});
describe('A18 · indemnité de fin de contrat stipulée, jamais calculée', () => {
    it('exige montant positif et source', () => {
        expect((0, decompte_retenues_stipulations_1.motifRefusIndemniteStipulee)({ montantFc: 500_000, source: 'Contrat, art. 12' })).toBeNull();
        expect((0, decompte_retenues_stipulations_1.motifRefusIndemniteStipulee)({ montantFc: 500_000, source: '' })).toMatch(/source/);
        expect((0, decompte_retenues_stipulations_1.motifRefusIndemniteStipulee)({ montantFc: 0, source: 'x' })).toMatch(/positif/);
    });
});
//# sourceMappingURL=decompte-retenues-stipulations.spec.js.map