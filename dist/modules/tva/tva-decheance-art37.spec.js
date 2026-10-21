"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };
function service(achats) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                if (!compte?.OR)
                    return Promise.resolve([]);
                return Promise.resolve(achats.map((a) => ({
                    id: `l-${a.date}`,
                    tauxTvaId: TAUX.id,
                    compte: { numero: a.numero },
                    debit: a.tva,
                    credit: 0,
                    ecriture: {
                        date: new Date(a.date),
                        lignes: a.regle
                            ? [
                                {
                                    debit: 0,
                                    credit: a.tva * 10,
                                    compte: { numero: '40100000', classe: 'CLASSE_4' },
                                    lettrage: {
                                        statut: 'SOLDE',
                                        solde: 0,
                                        soldeAt: null,
                                        lignes: [
                                            { debit: 0, credit: a.tva * 10, ecriture: { date: new Date(a.date) } },
                                            { debit: a.tva * 10, credit: 0, ecriture: { date: new Date(a.regle) } },
                                        ],
                                    },
                                },
                            ]
                            : [],
                    },
                })));
            }),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
const MARS_2026 = new Date('2026-03-01');
const FIN_MARS_2026 = new Date('2026-03-31T23:59:59.999Z');
describe('Déchéance du droit à déduction · article 37, alinéa 2', () => {
    it('compte et NOMME la TVA d’amont dont le délai est expiré', async () => {
        const s = service([{ numero: '44520000', date: '2024-05-10', tva: 500_000 }]);
        const d = await s.declaration('t1', MARS_2026, FIN_MARS_2026);
        expect(d.totalDeductible).toBe(0);
        expect(d.tvaDeductibleDechue).toBe(500_000);
        expect(d.mentionExigibilite).toContain('DÉLAI DE DÉDUCTION EXPIRÉ');
        expect(d.mentionExigibilite).toContain('article 37, alinéa 2');
        expect(d.mentionExigibilite).toContain('acquise définitivement au');
    });
    it('ne signale RIEN pour une taxe exigible l’année précédente · le délai court jusqu’au 31 décembre', async () => {
        const s = service([{ numero: '44520000', date: '2025-11-10', tva: 500_000 }]);
        const d = await s.declaration('t1', MARS_2026, FIN_MARS_2026);
        expect(d.tvaDeductibleDechue).toBe(0);
        expect(d.mentionExigibilite).not.toContain('DÉLAI DE DÉDUCTION EXPIRÉ');
    });
    it('le délai court de l’EXIGIBILITÉ · une prestation de 2023 réglée en 2026 est déductible en 2026', async () => {
        const s = service([{ numero: '44540000', date: '2023-09-10', tva: 160_000, regle: '2026-03-18' }]);
        const d = await s.declaration('t1', MARS_2026, FIN_MARS_2026);
        expect(d.totalDeductible).toBe(160_000);
        expect(d.tvaDeductibleDechue).toBe(0);
    });
});
//# sourceMappingURL=tva-decheance-art37.spec.js.map