"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const licence_service_1 = require("./licence.service");
const JOUR_MS = 24 * 60 * 60 * 1000;
const licence = (champs) => ({
    id: 'l1',
    tenantId: 't1',
    type: client_1.TypeLicence.PERPETUEL_ONPREMISE,
    statut: client_1.StatutLicence.ACTIVE,
    dateDebut: new Date('2026-01-01'),
    dateExpiration: null,
    dernierHeartbeatAt: null,
    joursGraceHorsLigne: 7,
    ...champs,
});
describe('LicenceService · motif de refus d’une licence « Perpétuelle (sur site) »', () => {
    const service = new licence_service_1.LicenceService(undefined);
    it('heartbeat JAMAIS reçu : le motif dit que rien n’a jamais été reçu, il ne parle pas de dépassement', () => {
        const { autorise, motif } = service.evaluerLicence(licence({ dernierHeartbeatAt: null }));
        expect(autorise).toBe(false);
        expect(motif).toContain("aucune vérification en ligne n'a jamais été reçue");
        expect(motif).not.toContain('hors-ligne dépassée');
    });
    it('heartbeat TROP ANCIEN : le motif porte la date du dernier et la tolérance, pour dater la coupure', () => {
        const vieux = new Date(Date.now() - 30 * JOUR_MS);
        const { autorise, motif } = service.evaluerLicence(licence({ dernierHeartbeatAt: vieux, joursGraceHorsLigne: 7 }));
        expect(autorise).toBe(false);
        expect(motif).toContain(vieux.toISOString().slice(0, 10));
        expect(motif).toContain('tolérance de 7 jours');
        expect(motif).not.toContain("n'a jamais été reçue");
    });
    it('les deux pannes ne portent JAMAIS le même motif · c’est tout l’objet de la correction', () => {
        const jamais = service.evaluerLicence(licence({ dernierHeartbeatAt: null })).motif;
        const tropAncien = service.evaluerLicence(licence({ dernierHeartbeatAt: new Date(Date.now() - 30 * JOUR_MS) })).motif;
        expect(jamais).not.toBe(tropAncien);
    });
    it('heartbeat frais : l’accès reste ouvert, la tolérance est bien comptée en jours', () => {
        expect(service.evaluerLicence(licence({ dernierHeartbeatAt: new Date(Date.now() - 3 * JOUR_MS) }))).toEqual({
            autorise: true,
        });
        expect(service.evaluerLicence(licence({ dernierHeartbeatAt: new Date(Date.now() - 10 * JOUR_MS), joursGraceHorsLigne: 30 }))).toEqual({ autorise: true });
    });
    it('la suspension prime sur le heartbeat · une licence suspendue n’est pas un problème de réseau', () => {
        const { motif } = service.evaluerLicence(licence({ statut: client_1.StatutLicence.SUSPENDUE, dernierHeartbeatAt: null }));
        expect(motif).toBe('Licence suspendue');
    });
});
describe('LicenceService · les autres types ne sont pas touchés par le heartbeat', () => {
    const service = new licence_service_1.LicenceService(undefined);
    it('PERPETUEL_SAAS passe sans heartbeat, ABONNEMENT ne dépend que de son échéance', () => {
        expect(service.evaluerLicence(licence({ type: client_1.TypeLicence.PERPETUEL_SAAS, dernierHeartbeatAt: null }))).toEqual({ autorise: true });
        expect(service.evaluerLicence(licence({
            type: client_1.TypeLicence.ABONNEMENT,
            dernierHeartbeatAt: null,
            dateExpiration: new Date(Date.now() + 30 * JOUR_MS),
        }))).toEqual({ autorise: true });
        expect(service.evaluerLicence(licence({
            type: client_1.TypeLicence.ABONNEMENT,
            dateExpiration: new Date(Date.now() - JOUR_MS),
        })).motif).toBe('Abonnement expiré');
    });
    it('aucune licence : le motif le dit, il ne parle pas de heartbeat', () => {
        expect(service.evaluerLicence(null)).toEqual({
            autorise: false,
            motif: 'Aucune licence associée à ce tenant',
        });
    });
});
//# sourceMappingURL=licence.spec.js.map