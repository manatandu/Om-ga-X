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
                const ou = where.ecriture.OR[0].date.lte;
                return Promise.resolve(achats
                    .filter((a) => new Date(a.date) <= ou || (a.regle && new Date(a.regle) <= ou))
                    .map((a) => ({
                    id: `l-${a.date}-${a.numero}`,
                    tauxTvaId: TAUX.id,
                    compte: { numero: a.numero },
                    debit: a.tva,
                    credit: 0,
                    ecriture: {
                        date: new Date(a.date),
                        facture: a.facture
                            ? {
                                nature: 'FACTURE',
                                sens: 'ACHAT',
                                mentionTvaDebits: false,
                                dateFacture: new Date(a.facture.dateFacture),
                                dateReception: a.facture.dateReception ? new Date(a.facture.dateReception) : null,
                            }
                            : null,
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
const mois = (a, m) => [new Date(Date.UTC(a, m - 1, 1)), new Date(Date.UTC(a, m, 0, 23, 59, 59, 999))];
describe('TVA d’une facture d’achat reçue après sa date (ligne A21)', () => {
    const recue = { numero: '44520000', date: '2026-01-05', tva: 160_000, facture: { dateFacture: '2025-12-28', dateReception: '2026-01-05' } };
    it('se déduit dans le mois de la RÉCEPTION, et non dans celui de la facture', async () => {
        const decembre = await service([recue]).declaration('t1', ...mois(2025, 12));
        expect(decembre.totalDeductible).toBe(0);
        const janvier = await service([recue]).declaration('t1', ...mois(2026, 1));
        expect(janvier.totalDeductible).toBe(160_000);
        expect(janvier.tvaDeductibleDechue).toBe(0);
    });
    it('le délai de l’art. 37 al. 2 court de la FACTURE · reçue en 2027, une facture de 2025 est déchue et ne se déduit plus', async () => {
        const tardive = { numero: '44520000', date: '2027-01-10', tva: 160_000, facture: { dateFacture: '2025-12-28', dateReception: '2027-01-10' } };
        const d = await service([tardive]).declaration('t1', ...mois(2027, 1));
        expect(d.totalDeductible).toBe(0);
        expect(d.tvaDeductibleDechue).toBe(160_000);
        expect(d.mentionExigibilite).toContain('DÉLAI DE DÉDUCTION EXPIRÉ');
    });
    it('sans date de réception (pièce d’avant A21), rien ne change · le délai court de l’écriture', async () => {
        const ancienne = { numero: '44520000', date: '2027-01-10', tva: 160_000, facture: { dateFacture: '2025-12-28', dateReception: null } };
        const d = await service([ancienne]).declaration('t1', ...mois(2027, 1));
        expect(d.totalDeductible).toBe(160_000);
        expect(d.tvaDeductibleDechue).toBe(0);
    });
    it('une prestation datée à l’encaissement reste au RÈGLEMENT · la réception ne la déplace pas', async () => {
        const service4454 = { numero: '44540000', date: '2027-01-10', tva: 160_000, facture: { dateFacture: '2025-12-28', dateReception: '2027-01-10' }, regle: '2027-01-20' };
        const d = await service([service4454]).declaration('t1', ...mois(2027, 1));
        expect(d.totalDeductible).toBe(160_000);
        expect(d.tvaDeductibleDechue).toBe(0);
    });
});
//# sourceMappingURL=tva-facture-recue-a21.spec.js.map