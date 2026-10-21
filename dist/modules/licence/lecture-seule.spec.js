"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const licence_guard_1 = require("./licence.guard");
const licence_service_1 = require("./licence.service");
describe('LicenceGuard · abonnement échu en lecture seule', () => {
    const service = new licence_service_1.LicenceService({});
    const garde = new licence_guard_1.LicenceGuard(service);
    const hier = new Date(Date.now() - 86_400_000);
    const licence = (statut) => ({
        id: 'l1',
        tenantId: 'd1',
        type: client_1.TypeLicence.ABONNEMENT,
        statut,
        dateDebut: new Date('2026-01-01'),
        dateExpiration: hier,
        dernierHeartbeatAt: null,
        joursGraceHorsLigne: 7,
    });
    const contexte = (method, statut = client_1.StatutLicence.ACTIVE) => ({
        switchToHttp: () => ({ getRequest: () => ({ method, user: { tenantId: 'd1', licence: licence(statut) } }) }),
    });
    it('une lecture passe', async () => {
        await expect(garde.canActivate(contexte('GET'))).resolves.toBe(true);
    });
    it('une écriture est refusée, et le refus dit la lecture seule', async () => {
        for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            await expect(garde.canActivate(contexte(m))).rejects.toThrow(/lecture seule/);
        }
    });
    it('une licence suspendue reste fermée, même en lecture', async () => {
        await expect(garde.canActivate(contexte('GET', client_1.StatutLicence.SUSPENDUE))).rejects.toBeInstanceOf(common_1.ForbiddenException);
    });
});
//# sourceMappingURL=lecture-seule.spec.js.map