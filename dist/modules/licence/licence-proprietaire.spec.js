"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const licence_service_1 = require("./licence.service");
const plateforme_service_1 = require("../plateforme/plateforme.service");
const licence = (p) => ({
    id: 'l1',
    tenantId: 't1',
    type: client_1.TypeLicence.PROPRIETAIRE,
    statut: client_1.StatutLicence.ACTIVE,
    dateDebut: new Date('2026-01-01'),
    dateExpiration: null,
    dernierHeartbeatAt: null,
    joursGraceHorsLigne: 7,
    ...p,
});
const service = () => new licence_service_1.LicenceService({});
describe("l'éditeur n'est jamais coupé", () => {
    it('une échéance dépassée ne le coupe pas', () => {
        const r = service().evaluerLicence(licence({ dateExpiration: new Date('2020-01-01') }));
        expect(r.autorise).toBe(true);
    });
    it('une SUSPENSION ne le coupe pas non plus · c’est le cas qui compte', () => {
        const r = service().evaluerLicence(licence({ statut: client_1.StatutLicence.SUSPENDUE }));
        expect(r.autorise).toBe(true);
        expect(r.motif).toBeUndefined();
    });
    it('un client, lui, reste coupé · l’exemption ne fuit pas', () => {
        const expire = service().evaluerLicence(licence({ type: client_1.TypeLicence.ABONNEMENT, dateExpiration: new Date('2020-01-01') }));
        expect(expire.autorise).toBe(false);
        expect(expire.motif).toBe('Abonnement expiré');
        const suspendu = service().evaluerLicence(licence({ type: client_1.TypeLicence.PERPETUEL_SAAS, statut: client_1.StatutLicence.SUSPENDUE }));
        expect(suspendu.autorise).toBe(false);
        expect(suspendu.motif).toBe('Licence suspendue');
    });
});
describe('la console ne peut pas défaire la protection', () => {
    function console(typeActuel) {
        const prisma = {
            licence: {
                findUnique: jest.fn().mockResolvedValue(licence({ type: typeActuel })),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
        };
        return {
            service: new plateforme_service_1.PlateformeService(prisma, {}, {}),
            prisma,
        };
    }
    it('refuse de suspendre le dossier de l’éditeur', async () => {
        const { service: s, prisma } = console(client_1.TypeLicence.PROPRIETAIRE);
        await expect(s.modifierLicence('t1', { statut: client_1.StatutLicence.SUSPENDUE })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(prisma.licence.update).not.toHaveBeenCalled();
    });
    it('refuse de lui poser une échéance', async () => {
        const { service: s } = console(client_1.TypeLicence.PROPRIETAIRE);
        await expect(s.modifierLicence('t1', { dateExpiration: '2026-12-31' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse surtout de CHANGER SON TYPE · le seul geste que rien ne rattrape', async () => {
        const { service: s } = console(client_1.TypeLicence.PROPRIETAIRE);
        await expect(s.modifierLicence('t1', { type: client_1.TypeLicence.ABONNEMENT })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse de FABRIQUER un second éditeur depuis la console', async () => {
        const { service: s } = console(client_1.TypeLicence.ABONNEMENT);
        await expect(s.modifierLicence('t1', { type: client_1.TypeLicence.PROPRIETAIRE })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('laisse passer une modification ordinaire sur un dossier client', async () => {
        const { service: s, prisma } = console(client_1.TypeLicence.ABONNEMENT);
        prisma.licence.update.mockResolvedValue({
            type: client_1.TypeLicence.ABONNEMENT,
            statut: client_1.StatutLicence.SUSPENDUE,
            dateDebut: new Date(),
            dateExpiration: null,
            dernierHeartbeatAt: null,
        });
        prisma.licence.updateMany.mockResolvedValue({ count: 0 });
        await expect(s.modifierLicence('t1', { statut: client_1.StatutLicence.SUSPENDUE })).resolves.toBeDefined();
    });
});
//# sourceMappingURL=licence-proprietaire.spec.js.map