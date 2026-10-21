"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const session_longue_1 = require("../auth/session-longue");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const operateur_plateforme_guard_1 = require("./operateur-plateforme.guard");
const plateforme_service_1 = require("./plateforme.service");
const plateforme_dto_1 = require("./dto/plateforme.dto");
const contexte_cloisonnement_1 = require("../../common/cloisonnement/contexte-cloisonnement");
const sessionRecente = () => ({ authentification: Math.floor(Date.now() / 1000) - 60, connexionComplete: Math.floor(Date.now() / 1000) - 60 });
const contexte = (user, session = sessionRecente()) => ({
    switchToHttp: () => ({ getRequest: () => ({ user, [session_longue_1.CLE_SESSION_REQUETE]: session }) }),
});
describe('OperateurPlateformeGuard', () => {
    const garde = new operateur_plateforme_guard_1.OperateurPlateformeGuard();
    it('refuse un utilisateur ordinaire, un drapeau absent et un drapeau non booléen', () => {
        expect(() => garde.canActivate(contexte({ userId: 'u1', estOperateurPlateforme: false }))).toThrow(common_1.ForbiddenException);
        expect(() => garde.canActivate(contexte({ userId: 'u1' }))).toThrow(common_1.ForbiddenException);
        expect(() => garde.canActivate(contexte(undefined))).toThrow(common_1.ForbiddenException);
        expect(() => garde.canActivate(contexte({ userId: 'u1', estOperateurPlateforme: 'true' }))).toThrow(common_1.ForbiddenException);
    });
    it("laisse passer l'opérateur qui a activé la double authentification", () => {
        expect(garde.canActivate(contexte({ userId: 'u1', estOperateurPlateforme: true, doubleAuthentificationActive: true }))).toBe(true);
    });
    it('refuse l’opérateur sans double authentification, et le dit', () => {
        expect(() => garde.canActivate(contexte({ userId: 'u1', estOperateurPlateforme: true }))).toThrow(operateur_plateforme_guard_1.MOTIF_CONSOLE_SANS_DOUBLE_AUTH);
        expect(operateur_plateforme_guard_1.MOTIF_CONSOLE_SANS_DOUBLE_AUTH).toContain('Fichier > Mon compte…');
        expect(() => garde.canActivate(contexte({ userId: 'u1', estOperateurPlateforme: true, doubleAuthentificationActive: false }))).toThrow(common_1.ForbiddenException);
    });
    it('refuse une connexion complète de plus de huit heures, ou inconnue, comme une session perdue', () => {
        const operateur = { userId: 'u1', estOperateurPlateforme: true, doubleAuthentificationActive: true };
        const maintenant = Math.floor(Date.now() / 1000);
        expect(garde.canActivate(contexte(operateur, { connexionComplete: maintenant - 8 * 3600 + 60 }))).toBe(true);
        for (const session of [
            { connexionComplete: maintenant - 8 * 3600 - 60 },
            { connexionComplete: null },
            { authentification: maintenant - 60, connexionComplete: maintenant - 3 * 86_400 },
            { authentification: maintenant - 60 },
            null,
        ]) {
            try {
                garde.canActivate(contexte(operateur, session));
                throw new Error('la garde aurait dû refuser');
            }
            catch (e) {
                expect(e).toBeInstanceOf(common_1.UnauthorizedException);
                expect(e.getResponse()).toMatchObject({
                    message: session_longue_1.MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE,
                    session: jwt_auth_guard_1.SIGNAL_SESSION_PERDUE,
                });
            }
        }
    });
});
describe('PlateformeService · bootstrap des opérateurs', () => {
    it("accorde le drapeau aux adresses d'OPERATEURS_PLATEFORME, sans jamais le retirer", async () => {
        const appels = [];
        const prisma = {
            user: {
                updateMany: async (args) => {
                    appels.push(args);
                    return { count: 1 };
                },
            },
        };
        const config = { get: () => ' cabinet@exemple.cd , Associe@Exemple.CD ' };
        const service = new plateforme_service_1.PlateformeService(prisma, config, undefined);
        await service.onModuleInit();
        expect(appels).toHaveLength(2);
        expect(appels[0]).toEqual({
            where: { email: 'cabinet@exemple.cd', estOperateurPlateforme: false },
            data: { estOperateurPlateforme: true },
        });
        expect(appels[1].where.email).toBe('associe@exemple.cd');
        for (const a of appels) {
            expect(a.data).toEqual({ estOperateurPlateforme: true });
        }
    });
    it('variable absente : aucun appel en base (et surtout aucune destitution)', async () => {
        const prisma = {
            user: {
                updateMany: async () => {
                    throw new Error('ne doit pas être appelé');
                },
            },
        };
        const config = { get: () => undefined };
        const service = new plateforme_service_1.PlateformeService(prisma, config, undefined);
        await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
});
describe('PlateformeService · licences', () => {
    const service = (stubs) => new plateforme_service_1.PlateformeService({
        licence: {
            findUnique: async () => stubs.licence ?? null,
            update: async (args) => {
                stubs.data = args.data;
                return { ...stubs.licence, ...args.data };
            },
            updateMany: async () => ({ count: 0 }),
        },
    }, { get: () => undefined }, undefined);
    it('cabinet sans licence : introuvable', async () => {
        await expect(service({}).modifierLicence('t-inconnu', { statut: client_1.StatutLicence.SUSPENDUE })).rejects.toThrow(common_1.NotFoundException);
    });
    it('un PATCH vide est refusé plutôt que silencieusement sans effet', async () => {
        await expect(service({ licence: { tenantId: 't1' } }).modifierLicence('t1', {})).rejects.toThrow(common_1.BadRequestException);
    });
    it("la chaîne vide efface l'échéance, une date ISO la pose", async () => {
        const stubs = { licence: { tenantId: 't1' } };
        const s = service(stubs);
        await s.modifierLicence('t1', { dateExpiration: '' });
        expect(stubs.data.dateExpiration).toBeNull();
        await s.modifierLicence('t1', { dateExpiration: '2027-08-31' });
        expect(stubs.data.dateExpiration.toISOString().slice(0, 10)).toBe('2027-08-31');
    });
    it('EXPIREE ne se décrète pas · le DTO ne connaît qu’ACTIVE et SUSPENDUE', async () => {
        const decret = (0, class_transformer_1.plainToInstance)(plateforme_dto_1.ModifierLicenceDto, { statut: 'EXPIREE' });
        expect(await (0, class_validator_1.validate)(decret)).not.toHaveLength(0);
        const suspension = (0, class_transformer_1.plainToInstance)(plateforme_dto_1.ModifierLicenceDto, { statut: 'SUSPENDUE' });
        expect(await (0, class_validator_1.validate)(suspension)).toHaveLength(0);
    });
});
describe('PlateformeService · création d’un cabinet client', () => {
    it('réutilise le pipeline d’inscription : SYCEBNL imposé, mot de passe généré, jeton jamais retransmis', async () => {
        let dtoRecu;
        const authService = {
            register: async (dto) => {
                dtoRecu = dto;
                return {
                    tenant: { id: 't-nouveau', nom: dto.nomEntite },
                    exercice: { id: 'ex1' },
                    accessToken: 'jeton-du-client',
                };
            },
        };
        const majLicence = [];
        const majUser = [];
        const prisma = {
            licence: {
                update: async (args) => {
                    majLicence.push(args);
                    return {};
                },
            },
            user: {
                update: async (args) => {
                    majUser.push(args);
                    return {};
                },
            },
        };
        const s = new plateforme_service_1.PlateformeService(prisma, { get: () => undefined }, authService);
        const resultat = await s.creerCabinet({
            nomEntite: 'ASBL Lumière',
            emailAdmin: 'admin@lumiere.cd',
            typeLicence: client_1.TypeLicence.ABONNEMENT,
            dateExpiration: '2027-09-01',
        });
        expect(dtoRecu.referentiel).toBe(client_1.Referentiel.SYCEBNL);
        expect(dtoRecu.email).toBe('admin@lumiere.cd');
        expect(typeof dtoRecu.motDePasse).toBe('string');
        expect(dtoRecu.motDePasse.length).toBeGreaterThanOrEqual(16);
        expect(resultat.motDePasseTemporaire).toBe(dtoRecu.motDePasse);
        expect(resultat).not.toHaveProperty('accessToken');
        expect(majLicence).toHaveLength(1);
        expect(majLicence[0].where.tenantId).toBe('t-nouveau');
        expect(majUser[0]).toEqual({ where: { email: 'admin@lumiere.cd' }, data: { doitChangerMotDePasse: true } });
    });
    it('deux créations ne partagent jamais le même mot de passe', async () => {
        const motsDePasse = [];
        const authService = {
            register: async (dto) => {
                motsDePasse.push(dto.motDePasse);
                return { tenant: { id: 't', nom: dto.nomEntite }, exercice: null, accessToken: 'x' };
            },
        };
        const s = new plateforme_service_1.PlateformeService({ user: { update: async () => ({}) } }, { get: () => undefined }, authService);
        await s.creerCabinet({ nomEntite: 'A', emailAdmin: 'a@a.cd' });
        await s.creerCabinet({ nomEntite: 'B', emailAdmin: 'b@b.cd' });
        expect(motsDePasse[0]).not.toBe(motsDePasse[1]);
    });
});
describe('PlateformeService · groupe d’établissements', () => {
    const service = (tenants) => {
        const maj = [];
        const s = new plateforme_service_1.PlateformeService({
            tenant: {
                findUnique: async ({ where }) => {
                    const t = tenants[where.id];
                    return t
                        ? {
                            id: t.id,
                            dossierMereId: t.dossierMereId,
                            referentiel: t.referentiel ?? client_1.Referentiel.SYCEBNL,
                            _count: { cellules: t.cellules },
                        }
                        : null;
                },
                update: async (args) => {
                    maj.push(args);
                    return {};
                },
            },
        }, { get: () => undefined }, undefined);
        return { s, maj };
    };
    const TENANTS = {
        mere: { id: 'mere', dossierMereId: null, cellules: 2 },
        cellule: { id: 'cellule', dossierMereId: 'mere', cellules: 0 },
        libre: { id: 'libre', dossierMereId: null, cellules: 0 },
    };
    it('rattache un dossier libre à une mère, et le détache avec null', async () => {
        const { s, maj } = service(TENANTS);
        await s.modifierGroupe('libre', { dossierMereId: 'mere' });
        expect(maj[0]).toEqual({ where: { id: 'libre' }, data: { dossierMereId: 'mere' } });
        await s.modifierGroupe('cellule', { dossierMereId: null });
        expect(maj[1]).toEqual({ where: { id: 'cellule' }, data: { dossierMereId: null } });
    });
    it('un seul niveau, dans un seul sens : ni sa propre mère, ni une mère qui est cellule, ni une mère rétrogradée en cellule', async () => {
        const { s } = service(TENANTS);
        await expect(s.modifierGroupe('libre', { dossierMereId: 'libre' })).rejects.toThrow(common_1.BadRequestException);
        await expect(s.modifierGroupe('libre', { dossierMereId: 'cellule' })).rejects.toThrow(common_1.BadRequestException);
        await expect(s.modifierGroupe('mere', { dossierMereId: 'libre' })).rejects.toThrow(common_1.BadRequestException);
        await expect(s.modifierGroupe('libre', { dossierMereId: 'fantome' })).rejects.toThrow(common_1.NotFoundException);
    });
    const AVEC_SYSCOHADA = {
        ...TENANTS,
        mereEntreprise: { id: 'mereEntreprise', dossierMereId: null, cellules: 0, referentiel: client_1.Referentiel.SYSCOHADA },
        celluleEntreprise: { id: 'celluleEntreprise', dossierMereId: null, cellules: 0, referentiel: client_1.Referentiel.SYSCOHADA },
    };
    it('refuse de rattacher une cellule SYSCOHADA à une mère SYCEBNL', async () => {
        const { s, maj } = service(AVEC_SYSCOHADA);
        await expect(s.modifierGroupe('celluleEntreprise', { dossierMereId: 'mere' })).rejects.toThrow(common_1.BadRequestException);
        expect(maj).toEqual([]);
    });
    it('refuse de donner une cellule SYCEBNL à une mère SYSCOHADA', async () => {
        const { s, maj } = service(AVEC_SYSCOHADA);
        await expect(s.modifierGroupe('libre', { dossierMereId: 'mereEntreprise' })).rejects.toThrow(/même référentiel · la mère est SYSCOHADA, ce dossier est SYCEBNL/);
        expect(maj).toEqual([]);
    });
    it('rattache une succursale SYSCOHADA à un siège SYSCOHADA', async () => {
        const { s, maj } = service(AVEC_SYSCOHADA);
        await s.modifierGroupe('celluleEntreprise', { dossierMereId: 'mereEntreprise' });
        expect(maj[0]).toEqual({ where: { id: 'celluleEntreprise' }, data: { dossierMereId: 'mereEntreprise' } });
    });
    it('laisse DÉTACHER une cellule quel que soit son référentiel · on ne piège pas un dossier mal rattaché', async () => {
        const { s, maj } = service({
            ...AVEC_SYSCOHADA,
            celluleEntreprise: { id: 'celluleEntreprise', dossierMereId: 'mere', cellules: 0, referentiel: client_1.Referentiel.SYSCOHADA },
        });
        await s.modifierGroupe('celluleEntreprise', { dossierMereId: null });
        expect(maj[0]).toEqual({ where: { id: 'celluleEntreprise' }, data: { dossierMereId: null } });
    });
});
describe('PlateformeService · cascade de licence sur les cellules', () => {
    it('suspendre ou renouveler la mère fait le même geste sur toutes ses cellules', async () => {
        let cascade;
        const s = new plateforme_service_1.PlateformeService({
            licence: {
                findUnique: async () => ({ tenantId: 'mere' }),
                update: async ({ data }) => ({ ...data }),
                updateMany: async (args) => {
                    cascade = args;
                    return { count: 7 };
                },
            },
        }, { get: () => undefined }, undefined);
        const resultat = await s.modifierLicence('mere', { statut: client_1.StatutLicence.SUSPENDUE });
        expect(cascade.where).toEqual({ tenant: { dossierMereId: 'mere' } });
        expect(cascade.data).toEqual({ statut: client_1.StatutLicence.SUSPENDUE });
        expect(resultat.cellulesEnCascade).toBe(7);
    });
});
describe('PlateformeService · le mode sur site n’est pas attribuable à un dossier hébergé', () => {
    it('creerCabinet refuse PERPETUEL_ONPREMISE AVANT register · aucun dossier n’est semé derrière l’erreur', async () => {
        const registres = [];
        const authService = {
            register: async (dto) => {
                registres.push(dto);
                return { tenant: { id: 't', nom: 'x' }, exercice: null, accessToken: 'x' };
            },
        };
        const s = new plateforme_service_1.PlateformeService({
            licence: {
                update: async () => {
                    throw new Error('ne doit pas être appelé');
                },
            },
            user: {
                update: async () => {
                    throw new Error('ne doit pas être appelé');
                },
            },
        }, { get: () => undefined }, authService);
        await expect(s.creerCabinet({
            nomEntite: 'ASBL Lumière',
            emailAdmin: 'admin@lumiere.cd',
            typeLicence: client_1.TypeLicence.PERPETUEL_ONPREMISE,
        })).rejects.toThrow(common_1.BadRequestException);
        expect(registres).toEqual([]);
    });
    it('modifierLicence refuse PERPETUEL_ONPREMISE sans lire ni écrire · la cascade sur les cellules ne part pas', async () => {
        const appels = [];
        const s = new plateforme_service_1.PlateformeService({
            licence: {
                findUnique: async () => {
                    appels.push('findUnique');
                    return { tenantId: 't1' };
                },
                update: async () => {
                    appels.push('update');
                    return {};
                },
                updateMany: async () => {
                    appels.push('updateMany');
                    return { count: 0 };
                },
            },
        }, { get: () => undefined }, undefined);
        await expect(s.modifierLicence('t1', { type: client_1.TypeLicence.PERPETUEL_ONPREMISE })).rejects.toThrow(common_1.BadRequestException);
        expect(appels).toEqual([]);
    });
    it('le message dit POURQUOI · la licence sur site est un fichier signé, et il nomme le repli (audit final F171)', async () => {
        const s = new plateforme_service_1.PlateformeService({ licence: { findUnique: async () => ({ tenantId: 't1' }) } }, { get: () => undefined }, undefined);
        const erreur = await s
            .modifierLicence('t1', { type: client_1.TypeLicence.PERPETUEL_ONPREMISE })
            .catch((e) => e);
        const message = erreur.message;
        expect(message).toBe(plateforme_service_1.MOTIF_SUR_SITE_NON_ATTRIBUABLE);
        expect(message).toContain('fichier signé');
        expect(message).toContain('« Licences sur site »');
        expect(message).toContain('Perpétuelle (sur site)');
        expect(message).toContain('Perpétuelle (SaaS)');
    });
    it('les deux types livrables passent · le verrou ne ferme que le mode sur site', async () => {
        const ecrits = [];
        const s = new plateforme_service_1.PlateformeService({
            licence: {
                findUnique: async () => ({ tenantId: 't1' }),
                update: async ({ data }) => {
                    ecrits.push(data);
                    return data;
                },
                updateMany: async () => ({ count: 0 }),
            },
        }, { get: () => undefined }, undefined);
        await s.modifierLicence('t1', { type: client_1.TypeLicence.PERPETUEL_SAAS });
        await s.modifierLicence('t1', { type: client_1.TypeLicence.ABONNEMENT });
        expect(ecrits).toEqual([{ type: client_1.TypeLicence.PERPETUEL_SAAS }, { type: client_1.TypeLicence.ABONNEMENT }]);
    });
    it('un dossier qui PORTE déjà ce type reste réparable · c’est par ce PATCH qu’on l’en sort', async () => {
        let ecrit;
        const s = new plateforme_service_1.PlateformeService({
            licence: {
                findUnique: async () => ({ tenantId: 't1', type: client_1.TypeLicence.PERPETUEL_ONPREMISE }),
                update: async ({ data }) => {
                    ecrit = data;
                    return data;
                },
                updateMany: async () => ({ count: 0 }),
            },
        }, { get: () => undefined }, undefined);
        await s.modifierLicence('t1', { type: client_1.TypeLicence.PERPETUEL_SAAS });
        expect(ecrit).toEqual({ type: client_1.TypeLicence.PERPETUEL_SAAS });
        await s.modifierLicence('t1', { statut: client_1.StatutLicence.SUSPENDUE });
        expect(ecrit).toEqual({ statut: client_1.StatutLicence.SUSPENDUE });
    });
    it('le DTO connaît toujours le type · c’est le service qui refuse, pas la validation', async () => {
        const demande = (0, class_transformer_1.plainToInstance)(plateforme_dto_1.ModifierLicenceDto, { type: 'PERPETUEL_ONPREMISE' });
        expect(await (0, class_validator_1.validate)(demande)).toHaveLength(0);
    });
});
describe('PlateformeService · le dossier de l’éditeur se lit hors du dossier de la session (audit final F173)', () => {
    it('la lecture sort du cloisonnement, avec son motif · sinon elle est vide depuis tout autre dossier', async () => {
        let raison;
        const s = new plateforme_service_1.PlateformeService({
            licence: {
                findFirst: async ({ where }) => {
                    raison = (0, contexte_cloisonnement_1.raisonHorsCloisonnement)();
                    return where.type === client_1.TypeLicence.PROPRIETAIRE ? { tenantId: 'vmg' } : null;
                },
            },
        }, { get: () => undefined }, undefined);
        expect(await s.dossierEditeurId()).toBe('vmg');
        expect(raison).toContain("le dossier de l'éditeur");
    });
});
//# sourceMappingURL=plateforme.spec.js.map