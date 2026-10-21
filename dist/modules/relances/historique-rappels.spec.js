"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const relances_service_1 = require("./relances.service");
describe('Historique des rappels', () => {
    const monter = (total, rendus = total) => {
        const appels = {};
        const prisma = {
            relance: {
                findMany: async (a) => {
                    appels.findMany = a;
                    return Array.from({ length: Math.min(rendus, a.take) }, (_, i) => ({ id: `r${i}` }));
                },
                count: async (a) => {
                    appels.count = a;
                    return total;
                },
                aggregate: async (a) => {
                    appels.aggregate = a;
                    return { _sum: { montant: 1234.5 } };
                },
            },
        };
        return { svc: new relances_service_1.RelancesService(prisma, {}), appels };
    };
    it('borne la période sur la date de relance, jour de fin compris, et au dossier', async () => {
        const { svc, appels } = monter(3);
        const r = await svc.historique('t1', { compteId: 'c1', du: '2026-01-01', au: '2026-03-31' });
        const where = {
            tenantId: 't1',
            compteId: 'c1',
            dateRelance: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-03-31T23:59:59.999Z') },
        };
        expect(appels.findMany.where).toEqual(where);
        expect(appels.count.where).toEqual(where);
        expect(appels.aggregate.where).toEqual(where);
        expect(r).toMatchObject({ total: 3, tronque: false, montantTotal: 1234.5 });
    });
    it('une tranche se DIT · total pris sur le périmètre entier', async () => {
        const { svc, appels } = monter(relances_service_1.PLAFOND_HISTORIQUE + 40);
        const r = await svc.historique('t1');
        expect(appels.findMany.take).toBe(relances_service_1.PLAFOND_HISTORIQUE);
        expect(appels.findMany.where).toEqual({ tenantId: 't1' });
        expect(r.relances).toHaveLength(relances_service_1.PLAFOND_HISTORIQUE);
        expect(r).toMatchObject({ total: relances_service_1.PLAFOND_HISTORIQUE + 40, tronque: true });
    });
    it('une date illisible ou inversée est refusée, jamais ignorée', async () => {
        const { svc } = monter(0);
        await expect(svc.historique('t1', { du: '01/02/2026' })).rejects.toThrow(/illisible/);
        await expect(svc.historique('t1', { du: '2026-05-01', au: '2026-04-01' })).rejects.toThrow(/dépasse/);
    });
});
//# sourceMappingURL=historique-rappels.spec.js.map