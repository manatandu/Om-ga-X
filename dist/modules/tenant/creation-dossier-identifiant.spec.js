"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const tenant_service_1 = require("./tenant.service");
describe('TenantService.creerTenant · identifiant', () => {
    const service = () => {
        const recus = [];
        const prisma = {
            tenant: {
                create: jest.fn(async ({ data }) => {
                    recus.push(data);
                    return { ...data, licence: null };
                }),
            },
        };
        return { s: new tenant_service_1.TenantService(prisma), recus };
    };
    const base = { nom: 'Cellule', referentiel: client_1.Referentiel.SYCEBNL, typeLicence: client_1.TypeLicence.ABONNEMENT };
    it('reçu, il est celui de la ligne créée', async () => {
        const { s, recus } = service();
        await s.creerTenant({ ...base, id: 'id-tire' });
        expect(recus[0]).toMatchObject({ id: 'id-tire', nom: 'Cellule' });
    });
    it('absent, la base le tire', async () => {
        const { s, recus } = service();
        await s.creerTenant(base);
        expect(recus[0]).not.toHaveProperty('id');
    });
});
//# sourceMappingURL=creation-dossier-identifiant.spec.js.map