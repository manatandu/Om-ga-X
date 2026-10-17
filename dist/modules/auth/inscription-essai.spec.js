"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const inscription_essai_1 = require("./inscription-essai");
const MINUTE = 60_000;
const HEURE = 3_600_000;
function monter(options = {}) {
    const envois = [];
    const mises = [];
    const courrier = {
        etatDuTransport: () => ({ configure: options.transport ?? true }),
        envoyerUnSecret: async (tenantId, message, corpsGarde) => {
            if (options.envoiEchoue)
                throw new Error('SMTP hors service');
            envois.push({ tenantId, message, corpsGarde });
            return { id: 'm1', statut: 'ENVOYE', erreur: null };
        },
    };
    const debut = new Date('2026-10-10T08:00:00Z');
    const prisma = {
        licence: {
            findUnique: async () => options.licence === undefined
                ? { type: 'ABONNEMENT', dateDebut: debut, dateExpiration: new Date(debut.getTime() + 30 * 86_400_000) }
                : options.licence,
        },
        user: {
            findUnique: async () => options.utilisateur ?? null,
            update: async (arg) => {
                mises.push(arg.data);
                return {};
            },
        },
    };
    const service = new auth_service_1.AuthService(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {}, undefined, courrier);
    const appels = [];
    jest.spyOn(service, 'register').mockImplementation((async (dto, opts) => {
        appels.push({ dto, options: opts });
        if (options.conflit)
            throw new common_1.ConflictException('Un compte existe déjà avec cet email');
        return { tenant: { id: 'T-neuf' }, exercice: {}, accessToken: 'NE-DOIT-JAMAIS-SORTIR' };
    }));
    return { service, envois, mises, appels };
}
const demande = { nomEntite: '  Association Espoir ', referentiel: client_1.Referentiel.SYCEBNL, email: 'Nouveau@Exemple.cd' };
describe('briques pures', () => {
    it("l'essai dure trente jours, le même nombre que la facturation des abonnements", () => {
        expect(inscription_essai_1.JOURS_ESSAI).toBe(30);
        expect((0, inscription_essai_1.finDeLEssai)(new Date('2026-10-17T08:00:00Z')).toISOString()).toBe('2026-11-16T08:00:00.000Z');
        expect((0, inscription_essai_1.finDeLEssai)(new Date('2026-12-20T08:00:00Z')).toISOString()).toBe('2027-01-19T08:00:00.000Z');
    });
    it('le courriel porte le mot de passe, le corps gardé ne le porte pas et ne contient pas le corps', () => {
        const { corps, corpsGarde, sujet } = (0, inscription_essai_1.avisInscriptionEssai)('Zz9-secret-Zz9', new Date('2026-11-16T12:00:00Z'), true);
        expect(corps).toContain('Zz9-secret-Zz9');
        expect(corps).toContain('16 novembre 2026');
        expect(corpsGarde).not.toContain('Zz9-secret-Zz9');
        expect(corpsGarde.includes(corps)).toBe(false);
        expect(sujet).toMatch(/essai/i);
        expect((0, inscription_essai_1.avisInscriptionEssai)('x1', new Date(), false).sujet).not.toMatch(/dossier d'essai/);
    });
    it("seul un dossier à licence d'essai de trente jours se rouvre", () => {
        const d = new Date('2026-10-10T08:00:00Z');
        const fin = (jours) => new Date(d.getTime() + jours * 86_400_000);
        expect((0, inscription_essai_1.estUnDossierDEssai)({ type: 'ABONNEMENT', dateDebut: d, dateExpiration: fin(30) })).toBe(true);
        expect((0, inscription_essai_1.estUnDossierDEssai)({ type: 'ABONNEMENT', dateDebut: d, dateExpiration: fin(365) })).toBe(false);
        expect((0, inscription_essai_1.estUnDossierDEssai)({ type: 'ABONNEMENT', dateDebut: d, dateExpiration: null })).toBe(false);
        expect((0, inscription_essai_1.estUnDossierDEssai)({ type: 'PROPRIETAIRE', dateDebut: d, dateExpiration: fin(30) })).toBe(false);
        expect((0, inscription_essai_1.estUnDossierDEssai)(null)).toBe(false);
    });
    it('le renvoi : titulaire à changer, né depuis moins de 72 h, dernier envoi il y a 10 minutes au moins', () => {
        const maintenant = new Date('2026-10-17T12:00:00Z');
        const compte = (o) => ({
            doitChangerMotDePasse: true,
            createdAt: new Date(maintenant.getTime() - HEURE),
            sessionsInvalidesAvant: null,
            ...o,
        });
        expect((0, inscription_essai_1.renvoiPossible)(compte({}), maintenant)).toBe(true);
        expect((0, inscription_essai_1.renvoiPossible)(compte({ doitChangerMotDePasse: false }), maintenant)).toBe(false);
        expect((0, inscription_essai_1.renvoiPossible)(compte({ createdAt: new Date(maintenant.getTime() - (inscription_essai_1.FENETRE_RENVOI_HEURES + 1) * HEURE) }), maintenant)).toBe(false);
        expect((0, inscription_essai_1.renvoiPossible)(compte({ createdAt: new Date(maintenant.getTime() - 9 * MINUTE) }), maintenant)).toBe(false);
        expect((0, inscription_essai_1.renvoiPossible)(compte({ sessionsInvalidesAvant: new Date(maintenant.getTime() - 9 * MINUTE) }), maintenant)).toBe(false);
        expect((0, inscription_essai_1.renvoiPossible)(compte({ sessionsInvalidesAvant: new Date(maintenant.getTime() - inscription_essai_1.ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES * MINUTE) }), maintenant)).toBe(true);
    });
});
describe('AuthService.inscrireEnEssai', () => {
    it('sans messagerie, RIEN n est créé', async () => {
        const { service, appels } = monter({ transport: false });
        await expect(service.inscrireEnEssai(demande)).rejects.toBeInstanceOf(common_1.ServiceUnavailableException);
        expect(appels).toHaveLength(0);
    });
    it('une adresse neuve crée un dossier d ESSAI à échéance, au mot de passe provisoire, sans session', async () => {
        const { service, envois, appels } = monter();
        const avant = Date.now();
        const r = await service.inscrireEnEssai(demande);
        expect(appels).toHaveLength(1);
        const { dto, options } = appels[0];
        expect(dto.email).toBe('nouveau@exemple.cd');
        expect(dto.nomEntite).toBe('Association Espoir');
        expect(dto).not.toHaveProperty('typeLicence');
        expect(options.motDePasseProvisoire).toBe(true);
        const fin = options.dateExpirationLicence.getTime();
        expect(fin - avant).toBeGreaterThanOrEqual(inscription_essai_1.JOURS_ESSAI * 24 * HEURE - 5_000);
        expect(fin - avant).toBeLessThanOrEqual(inscription_essai_1.JOURS_ESSAI * 24 * HEURE + 5_000);
        expect(envois).toHaveLength(1);
        expect(envois[0].tenantId).toBe('T-neuf');
        expect(envois[0].message.destinataire).toBe('nouveau@exemple.cd');
        expect(envois[0].message.corps).toContain(dto.motDePasse);
        expect(envois[0].corpsGarde).not.toContain(dto.motDePasse);
        expect(dto.motDePasse.length).toBeGreaterThanOrEqual(10);
        expect(JSON.stringify(r)).not.toContain('NE-DOIT-JAMAIS-SORTIR');
        expect(r).not.toHaveProperty('accessToken');
        expect(r.joursEssai).toBe(30);
    });
    it('une adresse déjà prise rend la MÊME réponse et ne crée ni n envoie rien', async () => {
        const neuve = monter();
        const rNeuve = await neuve.service.inscrireEnEssai(demande);
        const prise = monter({
            utilisateur: { id: 'u1', tenantId: 't1', role: client_1.RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: false, createdAt: new Date('2026-01-01'), sessionsInvalidesAvant: null },
        });
        const rPrise = await prise.service.inscrireEnEssai(demande);
        expect(rPrise).toEqual(rNeuve);
        expect(prise.appels).toHaveLength(0);
        expect(prise.envois).toHaveLength(0);
        expect(prise.mises).toHaveLength(0);
    });
    it('un titulaire qui n a rien reçu reçoit un NOUVEAU mot de passe, à sa seule adresse, et ses sessions sont fermées', async () => {
        const { service, envois, mises, appels } = monter({
            utilisateur: {
                id: 'u1', tenantId: 't1', role: client_1.RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: true,
                createdAt: new Date(Date.now() - HEURE), sessionsInvalidesAvant: null,
            },
        });
        await service.inscrireEnEssai(demande);
        expect(appels).toHaveLength(0);
        expect(envois).toHaveLength(1);
        expect(envois[0].tenantId).toBe('t1');
        expect(envois[0].message.destinataire).toBe('nouveau@exemple.cd');
        expect(mises).toHaveLength(1);
        expect(mises[0].doitChangerMotDePasse).toBe(true);
        expect(mises[0].sessionsInvalidesAvant).toBeInstanceOf(Date);
        expect(String(mises[0].motDePasse)).toMatch(/^\$2[aby]\$/);
    });
    it('un renvoi trop rapproché, ou vers un compte qui n est pas un administrateur, ne part pas', async () => {
        for (const utilisateur of [
            { id: 'u1', tenantId: 't1', role: client_1.RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: true, createdAt: new Date(Date.now() - 2 * MINUTE), sessionsInvalidesAvant: null },
            { id: 'u2', tenantId: 't1', role: client_1.RoleUtilisateur.COMPTABLE, doitChangerMotDePasse: true, createdAt: new Date(Date.now() - HEURE), sessionsInvalidesAvant: null },
        ]) {
            const { service, envois, mises } = monter({ utilisateur });
            await service.inscrireEnEssai(demande);
            expect(envois).toHaveLength(0);
            expect(mises).toHaveLength(0);
        }
    });
    it("un cabinet ouvert autrement (licence qui n'est pas un essai de trente jours) n'est jamais touché", async () => {
        const utilisateur = { id: 'u1', tenantId: 't1', role: client_1.RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: true, createdAt: new Date(Date.now() - HEURE), sessionsInvalidesAvant: null };
        const { service, envois, mises } = monter({ utilisateur, licence: { type: 'ABONNEMENT', dateDebut: new Date('2026-10-10'), dateExpiration: new Date('2027-10-10') } });
        await service.inscrireEnEssai(demande);
        expect(envois).toHaveLength(0);
        expect(mises).toHaveLength(0);
    });
    it("deux demandes simultanées pour la même adresse neuve · la perdante reçoit la réponse commune, pas un refus", async () => {
        const { service } = monter({ conflit: true });
        const neutre = await monter().service.inscrireEnEssai(demande);
        await expect(service.inscrireEnEssai(demande)).resolves.toEqual(neutre);
    });
    it('un courriel qui ne part pas laisse un refus qui dit de recommencer, jamais un succès', async () => {
        const { service } = monter({ envoiEchoue: true });
        await expect(service.inscrireEnEssai(demande)).rejects.toThrow(/Recommencez dans une dizaine de minutes/);
    });
});
describe('AuthController · la porte est fermée à clé', () => {
    const controleur = (valeur) => {
        const service = { inscrireEnEssai: jest.fn(async () => ({ message: 'ok', joursEssai: 30 })) };
        const c = new auth_controller_1.AuthController(service, { get: (k) => (k === 'INSCRIPTION_ESSAI' ? valeur : undefined) });
        return { c, service };
    };
    it('sans INSCRIPTION_ESSAI, le serveur refuse et l écran n offre rien', async () => {
        for (const valeur of [undefined, '', 'false', 'oui', 'TRUE']) {
            const { c, service } = controleur(valeur);
            expect(c.etatInscriptionEssai().ouverte).toBe(false);
            await expect(c.inscrireEnEssai(demande)).rejects.toBeInstanceOf(common_1.ForbiddenException);
            expect(service.inscrireEnEssai).not.toHaveBeenCalled();
        }
    });
    it('avec INSCRIPTION_ESSAI=true, elle sert', async () => {
        const { c, service } = controleur('true');
        expect(c.etatInscriptionEssai()).toEqual({ ouverte: true, joursEssai: 30 });
        await c.inscrireEnEssai(demande);
        expect(service.inscrireEnEssai).toHaveBeenCalledTimes(1);
    });
    it('la route est limitée en débit : cinq par heure', () => {
        expect(Reflect.getMetadata('THROTTLER:LIMITdefault', auth_controller_1.AuthController.prototype.inscrireEnEssai)).toBe(5);
        expect(Reflect.getMetadata('THROTTLER:TTLdefault', auth_controller_1.AuthController.prototype.inscrireEnEssai)).toBe(3_600_000);
    });
    it('POST /auth/register reste fermé sans INSCRIPTION_PUBLIQUE', async () => {
        const c = new auth_controller_1.AuthController({ register: jest.fn() }, { get: () => undefined });
        await expect(c.register({}, {})).rejects.toBeInstanceOf(common_1.ForbiddenException);
    });
});
//# sourceMappingURL=inscription-essai.spec.js.map