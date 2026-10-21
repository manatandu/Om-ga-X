"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plateforme_service_1 = require("./plateforme.service");
const extension_cloisonnement_1 = require("../../common/cloisonnement/extension-cloisonnement");
const contexte_audit_1 = require("../../common/audit/contexte-audit");
describe('console · licence d’un cabinet client, à travers la garde', () => {
    const brut = {
        licence: {
            findUnique: async () => ({ tenantId: 'CLIENT', type: 'ABONNEMENT', statut: 'ACTIVE' }),
            findFirst: async () => ({ tenantId: 'CLIENT' }),
            update: async () => ({ type: 'ABONNEMENT', statut: 'SUSPENDUE', dateDebut: new Date(), dateExpiration: null, dernierHeartbeatAt: null }),
            updateMany: async () => ({ count: 0 }),
        },
    };
    const garde = (op) => (args) => (0, extension_cloisonnement_1.garderCloisonnement)(brut, { model: 'Licence', operation: op, args, query: () => brut.licence[op](args) });
    const prisma = { licence: { findUnique: garde('findUnique'), update: garde('update'), updateMany: garde('updateMany') } };
    it('l’opérateur, connecté à son dossier, suspend la licence d’un client', async () => {
        const service = new plateforme_service_1.PlateformeService(prisma, { get: () => undefined }, undefined);
        const r = await (0, contexte_audit_1.dansContexteAudit)({ acteurId: 'op', acteurEmail: 'op@vmg', tenantId: 'EDITEUR' }, () => service.modifierLicence('CLIENT', { statut: 'SUSPENDUE' }));
        expect(r).toMatchObject({ statut: 'SUSPENDUE' });
    });
});
describe('console · échéance de la licence d’un abonné', () => {
    const monte = (licence) => {
        const prisma = {
            licence: {
                findUnique: jest.fn(async () => licence),
                create: jest.fn(async () => ({})),
                update: jest.fn(async () => ({})),
                updateMany: jest.fn(async () => ({ count: 0 })),
            },
        };
        return { s: new plateforme_service_1.PlateformeService(prisma, { get: () => undefined }, undefined), prisma };
    };
    it('crée la licence d’abonnement si elle manque, et ne recule jamais l’échéance', async () => {
        const a = monte(null);
        await a.s.echeanceAbonnement('c', '2026-11-15');
        expect(a.prisma.licence.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantId: 'c', type: 'ABONNEMENT', statut: 'ACTIVE' }) });
        const b = monte({ type: 'ABONNEMENT', dateExpiration: new Date('2027-01-01T23:59:59Z') });
        await expect(b.s.echeanceAbonnement('c', '2026-12-15')).resolves.toBe('2027-01-01');
        expect(b.prisma.licence.update).not.toHaveBeenCalled();
        const c = monte({ type: 'ABONNEMENT', dateExpiration: new Date('2026-11-15T23:59:59Z') });
        await c.s.echeanceAbonnement('c', '2026-12-15');
        expect(c.prisma.licence.update).toHaveBeenCalledWith({ where: { tenantId: 'c' }, data: { dateExpiration: new Date('2026-12-15T23:59:59Z') } });
    });
    it('refuse une licence perpétuelle ou celle de l’éditeur', async () => {
        await expect(monte({ type: 'PERPETUEL_SAAS' }).s.echeanceAbonnement('c', '2026-12-15')).rejects.toThrow(/perpétuelle/);
        await expect(monte({ type: 'PROPRIETAIRE' }).s.echeanceAbonnement('c', '2026-12-15')).rejects.toThrow(/éditeur/);
    });
});
describe('console · réinitialisation de l’administrateur d’un cabinet client, à travers la garde', () => {
    const admin = { id: 'adm', tenantId: 'CLIENT', email: 'admin@client.cd', role: 'ADMIN_CABINET' };
    const comptable = { id: 'cpt', tenantId: 'CLIENT', email: 'compta@client.cd', role: 'COMPTABLE' };
    const brut = {
        user: {
            findFirst: jest.fn(async ({ where }) => [admin, comptable].find((u) => u.tenantId === where.tenantId && u.email === where.email && (where.role === undefined || u.role === where.role)) ?? null),
            findUnique: async () => admin,
            update: jest.fn(async () => ({ ...admin })),
            updateMany: async () => ({ count: 1 }),
        },
    };
    const garde = (op) => (args) => (0, extension_cloisonnement_1.garderCloisonnement)(brut, { model: 'User', operation: op, args, query: () => brut.user[op](args) });
    const prisma = { user: { findFirst: garde('findFirst'), update: garde('update') } };
    const envoyerUnSecret = jest.fn().mockResolvedValue({ id: 'm1', statut: 'ENVOYE', erreur: null });
    const courrier = (configure) => ({ etatDuTransport: () => ({ configure }), envoyerUnSecret });
    const service = (configure = true) => new plateforme_service_1.PlateformeService(prisma, { get: () => undefined }, undefined, undefined, courrier(configure));
    it('l’opérateur, connecté au dossier de l’éditeur, réinitialise l’administrateur du client', async () => {
        const r = await (0, contexte_audit_1.dansContexteAudit)({ acteurId: 'op', acteurEmail: 'op@vmg', tenantId: 'EDITEUR' }, () => service().reinitialiserAdmin('CLIENT', { email: ' Admin@Client.CD ' }));
        expect(r).toEqual({ reinitialise: true, email: 'admin@client.cd', courriel: 'ENVOYE' });
        expect(brut.user.update).toHaveBeenCalledTimes(1);
    });
    it('le mot de passe provisoire part au seul administrateur, jamais à la console', async () => {
        envoyerUnSecret.mockClear();
        const r = await (0, contexte_audit_1.dansContexteAudit)({ acteurId: 'op', acteurEmail: 'op@vmg', tenantId: 'EDITEUR' }, () => service().reinitialiserAdmin('CLIENT', { email: 'admin@client.cd' }));
        const [dossier, message, corpsGarde] = envoyerUnSecret.mock.calls[0];
        const motDePasse = /Mot de passe provisoire · (\S+)/.exec(message.corps)[1];
        expect({ dossier, destinataire: message.destinataire, longueur: motDePasse.length }).toEqual({
            dossier: 'CLIENT',
            destinataire: 'admin@client.cd',
            longueur: 16,
        });
        expect(JSON.stringify(r)).not.toContain(motDePasse);
        expect(corpsGarde).not.toContain(motDePasse);
    });
    it('un courriel qui ne part pas laisse l’ancien accès intact', async () => {
        brut.user.update.mockClear();
        envoyerUnSecret.mockRejectedValueOnce(new Error('Le courriel n’est pas parti'));
        await expect((0, contexte_audit_1.dansContexteAudit)({ acteurId: 'op', acteurEmail: 'op@vmg', tenantId: 'EDITEUR' }, () => service().reinitialiserAdmin('CLIENT', { email: 'admin@client.cd' }))).rejects.toThrow(/pas parti/);
        expect(brut.user.update).not.toHaveBeenCalled();
    });
    it('sans messagerie, rien n’est touché · le mot de passe n’aurait aucun chemin vers le client', async () => {
        brut.user.update.mockClear();
        await expect((0, contexte_audit_1.dansContexteAudit)({ acteurId: 'op', acteurEmail: 'op@vmg', tenantId: 'EDITEUR' }, () => service(false).reinitialiserAdmin('CLIENT', { email: 'admin@client.cd' }))).rejects.toThrow(/Aucune messagerie/);
        expect(brut.user.update).not.toHaveBeenCalled();
    });
    it('l’opérateur ne réinitialise que l’administrateur, jamais un autre compte du dossier', async () => {
        await expect((0, contexte_audit_1.dansContexteAudit)({ acteurId: 'op', acteurEmail: 'op@vmg', tenantId: 'EDITEUR' }, () => service().reinitialiserAdmin('CLIENT', { email: 'compta@client.cd' }))).rejects.toThrow(/Aucun administrateur/);
    });
    it('un compte qui n’est pas l’administrateur de CE dossier reste introuvable', async () => {
        await expect((0, contexte_audit_1.dansContexteAudit)({ acteurId: 'op', acteurEmail: 'op@vmg', tenantId: 'EDITEUR' }, () => service().reinitialiserAdmin('AUTRE', { email: 'admin@client.cd' }))).rejects.toThrow(/Aucun administrateur/);
    });
});
//# sourceMappingURL=licence-client-cloisonnement.spec.js.map