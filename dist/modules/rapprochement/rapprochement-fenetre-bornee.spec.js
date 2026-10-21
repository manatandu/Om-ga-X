"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rapprochement_service_1 = require("./rapprochement.service");
function monter(options = {}) {
    const rapprochement = {
        id: 'rap',
        tenantId: 't1',
        compteId: '521',
        statut: 'EN_COURS',
        soldeReleve: 500,
        clotureAt: null,
        soldeDepartDeclare: 0,
        dateDepart: new Date('2026-01-01T00:00:00Z'),
    };
    const releve = (options.releve ?? []).map((r, i) => ({ ...r, rang: i, libelle: 'x', reference: null, debit: 0, credit: 100 }));
    const prisma = {
        rapprochementBancaire: {
            findFirst: jest.fn(async ({ where }) => (where.statut === 'CLOTURE' ? null : rapprochement)),
        },
        exercice: { findFirst: jest.fn(async () => ({ id: 'ex1' })) },
        ligneReleveBancaire: { findMany: jest.fn().mockResolvedValue(releve) },
        encoursOuvertureRapprochement: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn(async ({ where }) => ('OR' in where ? (options.total ?? 0) : 0)),
            aggregate: jest.fn().mockResolvedValue({ _sum: { debit: 700, credit: 200 } }),
        },
    };
    return { service: new rapprochement_service_1.RapprochementService(prisma), prisma };
}
describe('rapprochement · une tranche qui se dit, des soldes entiers (F185)', () => {
    it('la liste est bornée, le solde pointé vient d’un agrégat sur les lignes de CE rapprochement', async () => {
        const { service, prisma } = monter({ total: rapprochement_service_1.PLAFOND_LIGNES_RAPPROCHEMENT + 1 });
        const r = await service.obtenir('t1', 'rap');
        expect(prisma.ligneEcriture.findMany.mock.calls[0][0].take).toBe(rapprochement_service_1.PLAFOND_LIGNES_RAPPROCHEMENT);
        expect(prisma.ligneEcriture.aggregate.mock.calls[0][0].where).toEqual({
            compteId: '521',
            ecriture: { tenantId: 't1' },
            rapprochementId: 'rap',
        });
        expect(r.soldePointe).toBe(500);
        expect(r.equilibre).toBe(true);
        expect(r.tronque).toBe(true);
        expect(r.totalLignes).toBe(rapprochement_service_1.PLAFOND_LIGNES_RAPPROCHEMENT + 1);
    });
    it('les correspondances du relevé se lisent par leurs liens, pas dans la tranche', async () => {
        const { service, prisma } = monter({ releve: [{ id: 'r1', date: new Date('2026-03-10') }] });
        await service.obtenir('t1', 'rap');
        const appels = prisma.ligneEcriture.findMany.mock.calls.map((c) => c[0]);
        expect(appels.some((a) => JSON.stringify(a.where) === JSON.stringify({ ecriture: { tenantId: 't1' }, ligneReleveId: { in: ['r1'] } }))).toBe(true);
    });
    it('la proposition ne lit que la fenêtre de dates que ses passes exigent', async () => {
        const { service, prisma } = monter({
            releve: [
                { id: 'r1', date: new Date('2026-03-10T00:00:00Z') },
                { id: 'r2', date: new Date('2026-03-20T00:00:00Z') },
            ],
        });
        await service.proposer('t1', 'rap', 5);
        const where = prisma.ligneEcriture.findMany.mock.calls[0][0].where;
        expect(where.ecriture.date).toEqual({
            gte: new Date('2026-03-05T00:00:00Z'),
            lte: new Date('2026-03-25T00:00:00Z'),
        });
    });
    it('sans relevé, la proposition ne lit rien', async () => {
        const { service, prisma } = monter();
        await service.proposer('t1', 'rap');
        expect(prisma.ligneEcriture.findMany).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=rapprochement-fenetre-bornee.spec.js.map