"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
function service(opts) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        compte: { findMany: jest.fn().mockResolvedValue([{ id: 'c445' }]) },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue([
                { credit: opts.tvaCollectee, ecritureId: 'e1', compte: { numero: '44310000' }, tauxTva: { taux: 16 } },
            ]),
            aggregate: jest.fn().mockImplementation(({ where }) => {
                if (where.compteId) {
                    const date = where.ecriture.date;
                    const retenues = opts.lignes445.filter((l) => {
                        const d = new Date(l.date);
                        return d >= date.gte && d <= date.lte;
                    });
                    return Promise.resolve({
                        _sum: {
                            debit: retenues.reduce((s, l) => s + (l.debit ?? 0), 0),
                            credit: retenues.reduce((s, l) => s + (l.credit ?? 0), 0),
                        },
                    });
                }
                if (where.compte?.OR)
                    return Promise.resolve({ _sum: { credit: 0 } });
                return Promise.resolve({ _sum: { credit: opts.recettes } });
            }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: {
            findMany: jest.fn().mockResolvedValue(opts.liquidations.map((l, i) => ({
                id: `liq${i}`,
                dateDebut: new Date(l.dateDebut),
                dateFin: new Date(l.dateFin),
                prorataApplique: l.prorataApplique,
            }))),
        },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
const RECETTES = 100_000_000;
const TVA_COLLECTEE = 8_800_000;
describe('Prorata définitif · régularisation des déductions RÉELLEMENT opérées (art. 45)', () => {
    it('lit le prorata appliqué à CHAQUE période liquidée, au lieu d’en recalculer un seul', async () => {
        const s = service({
            recettes: RECETTES,
            tvaCollectee: TVA_COLLECTEE,
            lignes445: [
                { date: '2026-02-10', debit: 3_000_000 },
                { date: '2026-06-10', debit: 3_000_000 },
                { date: '2026-10-10', debit: 2_000_000 },
            ],
            liquidations: [
                { dateDebut: '2026-01-01', dateFin: '2026-04-30', prorataApplique: 90 },
                { dateDebut: '2026-05-01', dateFin: '2026-08-31', prorataApplique: 40 },
                { dateDebut: '2026-09-01', dateFin: '2026-12-31', prorataApplique: 70 },
            ],
        });
        const r = await s.prorataDefinitif('t1', 2026);
        expect(r.definitif.pourcentage).toBe(55);
        expect(r.admiseAppliquee).toBe(5_300_000);
        expect(r.admiseDefinitive).toBe(4_400_000);
        expect(r.regularisation).toBe(-900_000);
        expect(r.sens).toBe('REVERSEMENT');
        expect(r.regularisation).not.toBe(0);
    });
    it('rend le DÉTAIL par période · un taux moyen seul ne se vérifie pas', async () => {
        const s = service({
            recettes: RECETTES,
            tvaCollectee: TVA_COLLECTEE,
            lignes445: [
                { date: '2026-02-10', debit: 3_000_000 },
                { date: '2026-06-10', debit: 3_000_000 },
                { date: '2026-10-10', debit: 2_000_000 },
            ],
            liquidations: [
                { dateDebut: '2026-01-01', dateFin: '2026-04-30', prorataApplique: 90 },
                { dateDebut: '2026-05-01', dateFin: '2026-08-31', prorataApplique: 40 },
                { dateDebut: '2026-09-01', dateFin: '2026-12-31', prorataApplique: 70 },
            ],
        });
        const r = await s.prorataDefinitif('t1', 2026);
        expect(r.periodes).toHaveLength(3);
        expect(r.periodes[1]).toMatchObject({
            dateDebut: '2026-05-01',
            pourcentageApplique: 40,
            tvaDeductibleBrute: 3_000_000,
            deduite: 1_200_000,
        });
        expect(r.pourcentageApplique).toBe(66.25);
    });
    it('l’assiette se lit en SOLDE · un avoir fournisseur n’est pas de la taxe déduite', async () => {
        const s = service({
            recettes: RECETTES,
            tvaCollectee: TVA_COLLECTEE,
            lignes445: [
                { date: '2026-02-10', debit: 4_000_000 },
                { date: '2026-03-15', credit: 1_000_000 },
            ],
            liquidations: [{ dateDebut: '2026-01-01', dateFin: '2026-12-31', prorataApplique: 80 }],
        });
        const r = await s.prorataDefinitif('t1', 2026);
        expect(r.tvaDeductibleBrute).toBe(3_000_000);
        expect(r.admiseAppliquee).toBe(2_400_000);
        expect(r.admiseDefinitive).toBe(1_650_000);
    });
    it('SANS liquidation, ne prétend pas que « le définitif rejoint le provisoire »', async () => {
        const s = service({
            recettes: RECETTES,
            tvaCollectee: TVA_COLLECTEE,
            lignes445: [{ date: '2026-02-10', debit: 4_000_000 }],
            liquidations: [],
        });
        const r = await s.prorataDefinitif('t1', 2026);
        expect(r.regularisation).toBe(0);
        expect(r.pourcentageApplique).toBe(0);
        expect(r.echeance).toContain('Aucune liquidation');
        expect(r.echeance).toContain('31 mars 2027');
        expect(r.tvaDeductibleBruteAnnee).toBe(4_000_000);
    });
    it('annonce la part de l’année que AUCUNE liquidation ne couvre', async () => {
        const s = service({
            recettes: RECETTES,
            tvaCollectee: TVA_COLLECTEE,
            lignes445: [
                { date: '2026-02-10', debit: 3_000_000 },
                { date: '2026-11-10', debit: 5_000_000 },
            ],
            liquidations: [{ dateDebut: '2026-01-01', dateFin: '2026-06-30', prorataApplique: 80 }],
        });
        const r = await s.prorataDefinitif('t1', 2026);
        expect(r.tvaDeductibleBrute).toBe(3_000_000);
        expect(r.tvaDeductibleBruteAnnee).toBe(8_000_000);
        expect(r.tvaDeductibleNonLiquidee).toBe(5_000_000);
        expect(r.echeance).toContain('aucune liquidation');
        expect(r.echeance).toContain('31 mars 2027');
    });
});
//# sourceMappingURL=prorata-definitif-regularisation.spec.js.map