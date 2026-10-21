"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tenant_service_1 = require("./tenant.service");
describe('démarrage guidé · état du dossier', () => {
    const lignes = {
        exercice: [{ tenantId: 'A' }, { tenantId: 'B' }],
        journal: [{ tenantId: 'A' }, { tenantId: 'A' }, { tenantId: 'B' }],
        tiers: [{ tenantId: 'B' }],
        ecriture: [{ tenantId: 'B' }, { tenantId: 'B' }],
    };
    const compter = (table) => jest.fn(async ({ where }) => lignes[table].filter((l) => where?.tenantId === undefined || l.tenantId === where.tenantId).length);
    const prisma = {
        tenant: { findUnique: jest.fn(async () => ({ modulesActives: ['IFRS', 'PAIE'] })) },
        exercice: { count: compter('exercice') },
        journal: { count: compter('journal') },
        tiers: { count: compter('tiers') },
        ecriture: { count: compter('ecriture') },
    };
    it('compte les étapes du seul dossier, modules normalisés', async () => {
        const r = await new tenant_service_1.TenantService(prisma).demarrage('A');
        expect(r).toEqual({ exercices: 1, journaux: 2, tiers: 0, ecritures: 0, modulesActives: ['PAIE', 'IFRS'] });
    });
});
//# sourceMappingURL=demarrage-guide.spec.js.map