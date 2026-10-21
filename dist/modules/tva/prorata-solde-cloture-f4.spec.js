"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };
const TAXEES = 40_000_000;
const NON_QUALIFIEES = 10_000_000;
const CREDIT_DE_CLOTURE_SUR_709 = 3_000_000;
function service() {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                if (compte?.OR)
                    return Promise.resolve([]);
                if (compte?.numero?.startsWith !== '443')
                    return Promise.resolve([]);
                return Promise.resolve([
                    { credit: (TAXEES * 16) / 100, ecritureId: 'e-taxee', compte: { numero: '44310000' }, tauxTva: { taux: 16 } },
                ]);
            }),
            aggregate: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                const ecriture = where.ecriture;
                const cloture = ecriture?.estSoldeDesComptesDeGestion === false ? 0 : CREDIT_DE_CLOTURE_SUR_709;
                if (ecriture?.lignes?.none)
                    return Promise.resolve({ _sum: { credit: NON_QUALIFIEES + cloture } });
                if (compte?.OR)
                    return Promise.resolve({ _sum: { credit: 0 } });
                return Promise.resolve({ _sum: { credit: TAXEES + NON_QUALIFIEES + cloture } });
            }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
describe('Prorata · un exercice clos (régression de F4)', () => {
    it('ne compte pas le crédit de clôture comme une recette', async () => {
        const p = await service().calculerProrata('t1', new Date('2026-01-01'), new Date('2026-12-31T23:59:59.999Z'));
        expect(p.denominateur).toBe(TAXEES + NON_QUALIFIEES);
        expect(p.recettesNonQualifiees).toBe(NON_QUALIFIEES);
        expect(p.pourcentage).toBe(80);
    });
});
//# sourceMappingURL=prorata-solde-cloture-f4.spec.js.map