"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };
function service(taxees, nonQualifiees) {
    const recettesTotales = taxees + nonQualifiees;
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
                return Promise.resolve(taxees > 0
                    ? [{ credit: (taxees * 16) / 100, ecritureId: 'e-taxee', compte: { numero: '44310000' }, tauxTva: { taux: 16 } }]
                    : []);
            }),
            aggregate: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                const ecriture = where.ecriture;
                if (ecriture?.lignes?.none)
                    return Promise.resolve({ _sum: { credit: nonQualifiees } });
                if (compte?.OR)
                    return Promise.resolve({ _sum: { credit: 0 } });
                return Promise.resolve({ _sum: { credit: recettesTotales } });
            }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
const DEBUT = new Date('2026-01-01');
const FIN = new Date('2026-12-31T23:59:59.999Z');
describe('Prorata · les recettes que rien ne qualifie sont comptées et NOMMÉES', () => {
    it('rend le montant des recettes sans ligne de TVA, et cite les exportations', async () => {
        const s = service(40_000_000, 60_000_000);
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.numerateur).toBe(40_000_000);
        expect(p.denominateur).toBe(100_000_000);
        expect(p.pourcentage).toBe(40);
        expect(p.recettesNonQualifiees).toBe(60_000_000);
        expect(p.mentionDenominateur).toContain('EXPORTATIONS');
        expect(p.mentionDenominateur).toContain('sous-évalué');
    });
    it('ne dit rien quand toutes les recettes portent leur ligne de TVA', async () => {
        const s = service(40_000_000, 0);
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.recettesNonQualifiees).toBe(0);
        expect(p.pourcentage).toBe(100);
        expect(p.mentionDenominateur).not.toContain('EXPORTATIONS');
    });
    it('la déclaration porte l’avertissement, avec son montant et son article', async () => {
        const s = service(40_000_000, 60_000_000);
        const d = await s.declaration('t1', DEBUT, FIN);
        const mention = d.mentionExigibilite.replace(/[\u202f\u00a0]/g, ' ');
        expect(mention).toContain('60 000 000');
        expect(d.mentionExigibilite).toContain('SOUS-ÉVALUÉ');
        expect(d.mentionExigibilite).toContain('Y COMPRIS LES EXPORTATIONS');
    });
});
//# sourceMappingURL=prorata-recettes-non-qualifiees.spec.js.map