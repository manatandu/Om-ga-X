"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const variation_stocks_1 = require("./variation-stocks");
const compte = (over = {}) => ({
    numero: '31100000',
    intitule: 'Marchandises A',
    soldeInitial: 0,
    stockFinal: 0,
    source: "Campagne d'inventaire 2026",
    ...over,
});
describe('Variation de stocks · le schéma des deux textes', () => {
    it('annule le stock initial POUR SOLDE, puis constate le stock final', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: 300_000, stockFinal: 450_000 })], client_1.Referentiel.SYSCOHADA);
        expect(p.retenues).toHaveLength(1);
        expect(p.retenues[0].lignes).toEqual([
            expect.objectContaining({ compte: '31100000', sens: 'CREDIT', montant: 300_000 }),
            expect.objectContaining({ compte: '6031', sens: 'DEBIT', montant: 300_000 }),
            expect.objectContaining({ compte: '31100000', sens: 'DEBIT', montant: 450_000 }),
            expect.objectContaining({ compte: '6031', sens: 'CREDIT', montant: 450_000 }),
        ]);
    });
    it('l’écriture est ÉQUILIBRÉE par construction, sur plusieurs comptes', () => {
        const p = (0, variation_stocks_1.proposerVariations)([
            compte({ numero: '31100000', soldeInitial: 300_000, stockFinal: 450_000 }),
            compte({ numero: '32100000', soldeInitial: 1_200_000, stockFinal: 900_000 }),
            compte({ numero: '33100000', soldeInitial: 0, stockFinal: 75_000 }),
        ], client_1.Referentiel.SYSCOHADA);
        const t = (0, variation_stocks_1.totaux)((0, variation_stocks_1.lignesDeLEcriture)(p));
        expect(t.debit).toBe(t.credit);
        expect(t.debit).toBeGreaterThan(0);
    });
    it('LA FORME EST BRUTE, PAS NETTE · le stock initial est réellement soldé', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: 300_000, stockFinal: 450_000 })], client_1.Referentiel.SYSCOHADA);
        const surLeStock = p.retenues[0].lignes.filter((l) => l.compte === '31100000');
        expect(surLeStock).toHaveLength(2);
        expect(surLeStock.some((l) => l.montant === 150_000)).toBe(false);
    });
    it('un stock qui n’a jamais rien porté ne produit AUCUNE ligne', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: 0, stockFinal: 0 })], client_1.Referentiel.SYSCOHADA);
        expect(p.retenues).toHaveLength(0);
        expect(p.sansMouvement).toEqual(['31100000']);
    });
    it('un stock entièrement consommé solde le compte et ne constate rien', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: 500_000, stockFinal: 0 })], client_1.Referentiel.SYSCOHADA);
        expect(p.retenues[0].lignes).toEqual([
            expect.objectContaining({ compte: '31100000', sens: 'CREDIT', montant: 500_000 }),
            expect.objectContaining({ compte: '6031', sens: 'DEBIT', montant: 500_000 }),
        ]);
    });
});
describe('Variation de stocks · le référentiel commande, et il commande tout', () => {
    it('le MÊME 31 part au 6031 des deux côtés, sous deux intitulés différents', () => {
        const societe = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: 100, stockFinal: 200 })], client_1.Referentiel.SYSCOHADA);
        const association = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: 100, stockFinal: 200 })], client_1.Referentiel.SYCEBNL);
        expect(societe.retenues[0].correspondance.intitule).toBe('Marchandises');
        expect(association.retenues[0].correspondance.intitule).toBe("Biens liés à l'activité");
    });
    it('le 32 du SYCEBNL se sépare · marchandises au 6032, matières au 6033', () => {
        const p = (0, variation_stocks_1.proposerVariations)([
            compte({ numero: '32100000', soldeInitial: 0, stockFinal: 10 }),
            compte({ numero: '32300000', soldeInitial: 0, stockFinal: 20 }),
        ], client_1.Referentiel.SYCEBNL);
        expect(p.retenues[0].correspondance.variation).toBe('6032');
        expect(p.retenues[1].correspondance.variation).toBe('6033');
    });
    it('le 34 est un stock au SYSCOHADA et un DON EN NATURE au SYCEBNL', () => {
        const societe = (0, variation_stocks_1.proposerVariations)([compte({ numero: '34100000', soldeInitial: 0, stockFinal: 50 })], client_1.Referentiel.SYSCOHADA);
        expect(societe.retenues[0].correspondance.variation).toBe('7341');
        const association = (0, variation_stocks_1.proposerVariations)([compte({ numero: '34100000', soldeInitial: 0, stockFinal: 50 })], client_1.Referentiel.SYCEBNL);
        expect(association.retenues).toHaveLength(0);
        expect(association.refusees[0].motif).toBe('HORS_VARIATION_AUTOMATIQUE');
        expect(association.refusees[0].explication).toContain('EXTOURNÉES');
    });
});
describe('Variation de stocks · les refus, et ce qu’ils empêchent', () => {
    it('PAS ENCORE COMPTÉ n’est pas ZÉRO', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: 800_000, stockFinal: null })], client_1.Referentiel.SYSCOHADA);
        expect(p.retenues).toHaveLength(0);
        expect(p.refusees[0].motif).toBe('STOCK_FINAL_NON_COMPTE');
        expect(p.refusees[0].explication).toContain('inventaire extra-comptable');
    });
    it('un stock final NÉGATIF est refusé', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ stockFinal: -5 })], client_1.Referentiel.SYSCOHADA);
        expect(p.refusees[0].motif).toBe('STOCK_FINAL_NEGATIF');
    });
    it('un montant sans SOURCE est refusé · c’est elle que le réviseur demande', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ stockFinal: 1_000, source: '   ' })], client_1.Referentiel.SYSCOHADA);
        expect(p.refusees[0].motif).toBe('SOURCE_ABSENTE');
    });
    it('un compte qui n’est pas un stock de CE référentiel est refusé et NOMMÉ', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ numero: '60110000', stockFinal: 10 })], client_1.Referentiel.SYSCOHADA);
        expect(p.refusees[0].motif).toBe('PAS_UN_COMPTE_DE_STOCK');
        expect(p.refusees[0].explication).toContain('ne se transposent pas');
    });
    it('UN REFUS N’EMPORTE PAS LES AUTRES COMPTES', () => {
        const p = (0, variation_stocks_1.proposerVariations)([
            compte({ numero: '31100000', soldeInitial: 100, stockFinal: null }),
            compte({ numero: '32100000', soldeInitial: 200, stockFinal: 300 }),
        ], client_1.Referentiel.SYSCOHADA);
        expect(p.refusees).toHaveLength(1);
        expect(p.retenues).toHaveLength(1);
        expect(p.retenues[0].numero).toBe('32100000');
    });
    it('un solde CRÉDITEUR sur un stock est signalé, pas refusé', () => {
        const p = (0, variation_stocks_1.proposerVariations)([compte({ soldeInitial: -40_000, stockFinal: 10_000 })], client_1.Referentiel.SYSCOHADA);
        expect(p.retenues).toHaveLength(1);
        expect(p.avertissements[0]).toContain('CRÉDITEUR');
        expect(p.retenues[0].lignes[0]).toEqual(expect.objectContaining({ compte: '31100000', sens: 'DEBIT', montant: 40_000 }));
        const t = (0, variation_stocks_1.totaux)((0, variation_stocks_1.lignesDeLEcriture)(p));
        expect(t.debit).toBe(t.credit);
    });
});
//# sourceMappingURL=variation-stocks.spec.js.map