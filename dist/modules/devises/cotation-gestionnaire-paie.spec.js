"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const devises_controller_1 = require("./devises.controller");
const devises_service_1 = require("./devises.service");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const conversion_usd_1 = require("../personnel/conversion-usd");
const { ADMIN_CABINET, COMPTABLE, AIDE_COMPTABLE, GESTIONNAIRE_PAIE } = client_1.RoleUtilisateur;
const MATIN_DU_28 = new Date('2026-09-28T09:00:00Z');
const TARD_LE_27_UTC = new Date('2026-09-27T23:30:00Z');
describe('la règle · le gestionnaire de paie ne cote que le cours que sa paie lit', () => {
    it('admet le cours de l’USD à la date du jour, celle que la paie cherche', () => {
        expect(conversion_usd_1.DEVISE_DE_LA_PAIE).toBe('USD');
        expect((0, conversion_usd_1.motifRefusCotationGestionnairePaie)('USD', '2026-09-28', MATIN_DU_28)).toBeNull();
    });
    it('refuse une autre devise, même au jour dit · aucune paie ne la convertit', () => {
        expect((0, conversion_usd_1.motifRefusCotationGestionnairePaie)('EUR', '2026-09-28', MATIN_DU_28)).toMatch(/que le dollar américain \(USD\)/);
    });
    it('refuse la veille et le lendemain, en nommant le jour qu’il peut coter', () => {
        for (const autreJour of ['2026-09-27', '2026-09-29']) {
            expect((0, conversion_usd_1.motifRefusCotationGestionnairePaie)('USD', autreJour, MATIN_DU_28)).toMatch(/cours du jour.*le 28\/09\/2026/);
        }
    });
    it('refuse le bon jour posé à une autre heure · la paie le cherche par égalité sur minuit UTC', () => {
        expect((0, conversion_usd_1.motifRefusCotationGestionnairePaie)('USD', '2026-09-28T10:00:00Z', MATIN_DU_28)).not.toBeNull();
        expect((0, conversion_usd_1.motifRefusCotationGestionnairePaie)('USD', '2026-09-28T00:00:00.000Z', MATIN_DU_28)).toBeNull();
    });
    it('le jour est celui de Kinshasa · à 23 h 30 UTC le 27, c’est déjà le 28', () => {
        expect((0, conversion_usd_1.motifRefusCotationGestionnairePaie)('USD', '2026-09-28', TARD_LE_27_UTC)).toBeNull();
        expect((0, conversion_usd_1.motifRefusCotationGestionnairePaie)('USD', '2026-09-27', TARD_LE_27_UTC)).not.toBeNull();
    });
    it('le refus du cours déjà coté nomme le jour et renvoie au comptable', () => {
        expect((0, conversion_usd_1.messageCoursDejaCote)(new Date('2026-09-28T00:00:00.000Z'))).toMatch(/cours de l'USD du 28\/09\/2026 est déjà coté.*correction se demande au comptable/);
    });
    it('le refus du calcul de paie dit où coter et qui peut le faire', () => {
        const message = (0, conversion_usd_1.messageCoursManquant)(new Date('2026-09-28T00:00:00Z'));
        expect(message).toContain('fenêtre Devises');
        expect(message).toContain('ouverte au gestionnaire de paie pour ce seul cours');
        expect(message).toContain("l'administrateur l'ajoute d'abord");
    });
});
describe('les routes du module ouvertes au gestionnaire de paie, et elles seules', () => {
    const proto = devises_controller_1.DevisesController.prototype;
    const routes = Object.getOwnPropertyNames(devises_controller_1.DevisesController.prototype).filter((n) => n !== 'constructor');
    const OUVERTES = ['lister', 'poserCours'];
    const garde = new jwt_auth_guard_1.JwtAuthGuard(new core_1.Reflector());
    const parent = Object.getPrototypeOf(jwt_auth_guard_1.JwtAuthGuard.prototype);
    const contexte = (role, methode) => ({
        switchToHttp: () => ({ getRequest: () => ({ user: { role }, method: 'POST' }), getResponse: () => ({}) }),
        getHandler: () => proto[methode],
        getClass: () => devises_controller_1.DevisesController,
    });
    beforeEach(() => jest.spyOn(parent, 'canActivate').mockResolvedValue(true));
    afterEach(() => jest.restoreAllMocks());
    it('le recensement trouve encore les routes fermées · un garde-fou vide ne vérifie rien', () => {
        expect(routes).toEqual(expect.arrayContaining(['creer', 'modifier', 'calculer', 'reevaluer', 'listerReevaluations', 'extourner']));
    });
    it('lire les devises et coter un cours portent l’ouverture', () => {
        for (const methode of OUVERTES) {
            expect([methode, Reflect.getMetadata(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, proto[methode])]).toEqual([methode, { gestionnairePaie: true }]);
        }
    });
    it('JwtAuthGuard laisse le gestionnaire lire et coter', async () => {
        for (const methode of OUVERTES) {
            await expect(garde.canActivate(contexte(GESTIONNAIRE_PAIE, methode))).resolves.toBe(true);
        }
    });
    it('JwtAuthGuard lui ferme tout le reste · création, réévaluation, contre-passation', async () => {
        for (const methode of routes.filter((r) => !OUVERTES.includes(r))) {
            await expect(garde.canActivate(contexte(GESTIONNAIRE_PAIE, methode))).rejects.toThrow(/cantonné au personnel et à la paie/);
        }
    });
    it('RolesGuard le lit comme le comptable sur la cotation, jamais sur la création réservée à l’administrateur', () => {
        const roles = new roles_guard_1.RolesGuard(new core_1.Reflector());
        expect(roles.canActivate(contexte(GESTIONNAIRE_PAIE, 'poserCours'))).toBe(true);
        expect(() => roles.canActivate(contexte(GESTIONNAIRE_PAIE, 'creer'))).toThrow(common_1.ForbiddenException);
        expect(() => roles.canActivate(contexte(GESTIONNAIRE_PAIE, 'reevaluer'))).toThrow(common_1.ForbiddenException);
    });
    it('l’aide-comptable garde ce qu’il avait · il cote et réévalue comme avant', async () => {
        await expect(garde.canActivate(contexte(AIDE_COMPTABLE, 'poserCours'))).resolves.toBe(true);
        await expect(garde.canActivate(contexte(AIDE_COMPTABLE, 'reevaluer'))).resolves.toBe(true);
        expect(new roles_guard_1.RolesGuard(new core_1.Reflector()).canActivate(contexte(AIDE_COMPTABLE, 'poserCours'))).toBe(true);
    });
});
describe('le contrôleur borne la cotation du gestionnaire de paie', () => {
    const DEVISES_DU_DOSSIER = {
        't-1': [
            { id: 'usd', code: 'USD', cours: [{ date: new Date('2026-09-27T00:00:00.000Z') }] },
            { id: 'eur', code: 'EUR', cours: [] },
        ],
        't-2': [{ id: 'usd-2', code: 'USD', cours: [{ date: new Date('2026-09-28T00:00:00.000Z') }] }],
    };
    function monter() {
        const lister = jest.fn(async (tenantId) => DEVISES_DU_DOSSIER[tenantId] ?? []);
        const poserCours = jest.fn(async () => ({ ok: true }));
        const ajouterCours = jest.fn(async () => ({ ok: true }));
        const controleur = new devises_controller_1.DevisesController({ lister, poserCours, ajouterCours }, {});
        return { controleur, lister, poserCours, ajouterCours };
    }
    const utilisateur = (role, tenantId = 't-1') => ({ userId: 'u-1', tenantId, email: 'paie@exemple.cd', role });
    beforeEach(() => {
        jest.useFakeTimers({ now: MATIN_DU_28, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    });
    afterEach(() => jest.useRealTimers());
    it('cote l’USD du jour par la CRÉATION seule, jamais par l’upsert du comptable', async () => {
        const { controleur, lister, poserCours, ajouterCours } = monter();
        const dto = { date: '2026-09-28', cours: 2850.5, source: 'BCC' };
        await controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), 'usd', dto);
        expect(lister).toHaveBeenCalledWith('t-1');
        expect(ajouterCours).toHaveBeenCalledWith('t-1', 'usd', dto, (0, conversion_usd_1.messageCoursDejaCote)(new Date('2026-09-28T00:00:00.000Z')));
        expect(poserCours).not.toHaveBeenCalled();
    });
    it('le jour déjà coté part aussi à la création · c’est la base qui refuse, pas une liste de douze cours', async () => {
        const { controleur, lister, poserCours, ajouterCours } = monter();
        await controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE, 't-2'), 'usd-2', { date: '2026-09-28', cours: 9999 });
        expect(lister).toHaveBeenCalledWith('t-2');
        expect(ajouterCours).toHaveBeenCalledTimes(1);
        expect(poserCours).not.toHaveBeenCalled();
    });
    it('refuse une autre devise sans rien écrire', async () => {
        const { controleur, poserCours, ajouterCours } = monter();
        await expect(controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), 'eur', { date: '2026-09-28', cours: 3100 })).rejects.toThrow(common_1.ForbiddenException);
        expect(poserCours).not.toHaveBeenCalled();
        expect(ajouterCours).not.toHaveBeenCalled();
    });
    it('refuse un autre jour sans rien écrire', async () => {
        const { controleur, poserCours, ajouterCours } = monter();
        await expect(controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), 'usd', { date: '2026-09-27', cours: 2850 })).rejects.toThrow(/le 28\/09\/2026/);
        expect(poserCours).not.toHaveBeenCalled();
        expect(ajouterCours).not.toHaveBeenCalled();
    });
    it('une devise que la liste du dossier ne porte pas est refusée ici, sans rien écrire', async () => {
        const { controleur, poserCours, ajouterCours } = monter();
        for (const id of ['inconnue', 'usd-2']) {
            await expect(controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), id, { date: '2026-09-28', cours: 1 })).rejects.toThrow(common_1.NotFoundException);
        }
        expect(poserCours).not.toHaveBeenCalled();
        expect(ajouterCours).not.toHaveBeenCalled();
    });
    it('la borne ne vise que lui · le comptable et l’administrateur cotent toute devise à toute date, et corrigent', async () => {
        for (const role of [COMPTABLE, ADMIN_CABINET, AIDE_COMPTABLE]) {
            const { controleur, lister, poserCours, ajouterCours } = monter();
            await controleur.poserCours(utilisateur(role), 'eur', { date: '2026-01-15', cours: 3100 });
            expect(poserCours).toHaveBeenCalledTimes(1);
            expect(ajouterCours).not.toHaveBeenCalled();
            expect(lister).not.toHaveBeenCalled();
        }
    });
});
describe('un cours déjà coté ne se réécrit pas par le gestionnaire de paie', () => {
    function baseSimulee(coursInitiaux = []) {
        const devises = [{ id: 'usd', tenantId: 't-1', code: 'USD', intitule: 'Dollar' }];
        const cours = [...coursInitiaux];
        const cle = (deviseId, date) => `${deviseId}|${date.toISOString()}`;
        const doublon = () => new client_1.Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
        const prisma = {
            devise: {
                findMany: jest.fn(async ({ where }) => devises
                    .filter((d) => d.tenantId === where.tenantId)
                    .map((d) => ({
                    ...d,
                    cours: cours
                        .filter((c) => c.deviseId === d.id)
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .slice(0, 12),
                }))),
                findFirst: jest.fn(async ({ where }) => devises.find((d) => d.id === where.id && d.tenantId === where.tenantId) ?? null),
            },
            coursDevise: {
                create: jest.fn(async ({ data }) => {
                    if (cours.some((c) => cle(c.deviseId, c.date) === cle(data.deviseId, data.date)))
                        throw doublon();
                    cours.push({ ...data });
                    return data;
                }),
                upsert: jest.fn(async (args) => {
                    const k = cle(args.where.deviseId_date.deviseId, args.where.deviseId_date.date);
                    const existant = cours.find((c) => cle(c.deviseId, c.date) === k);
                    if (existant)
                        return Object.assign(existant, args.update);
                    cours.push({ ...args.create });
                    return args.create;
                }),
            },
        };
        const service = new devises_service_1.DevisesService(prisma, {});
        const controleur = new devises_controller_1.DevisesController(service, {});
        const coursDu = (iso) => cours.find((c) => c.date.toISOString() === new Date(iso).toISOString())?.cours.toString() ?? null;
        return { prisma, controleur, coursDu };
    }
    const utilisateur = (role) => ({ userId: 'u-1', tenantId: 't-1', email: 'x@exemple.cd', role });
    const JOUR = '2026-09-28T00:00:00.000Z';
    beforeEach(() => {
        jest.useFakeTimers({ now: MATIN_DU_28, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    });
    afterEach(() => jest.useRealTimers());
    it('le comptable a coté le jour · le gestionnaire est refusé en 409 nommé, et le cours reste celui du comptable', async () => {
        const { prisma, controleur, coursDu } = baseSimulee();
        await controleur.poserCours(utilisateur(COMPTABLE), 'usd', { date: '2026-09-28', cours: 2850 });
        const refus = controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), 'usd', { date: '2026-09-28', cours: 9999 });
        await expect(refus).rejects.toThrow(common_1.ConflictException);
        await expect(refus).rejects.toMatchObject({ status: 409 });
        await expect(refus).rejects.toThrow((0, conversion_usd_1.messageCoursDejaCote)(new Date(JOUR)));
        expect(coursDu(JOUR)).toBe('2850');
        expect(prisma.coursDevise.upsert).toHaveBeenCalledTimes(1);
    });
    it('même quand la liste ne montre plus le cours du jour · douze cours postérieurs le cachent, la base refuse quand même', async () => {
        const plusTard = Array.from({ length: 12 }, (_, i) => ({
            deviseId: 'usd',
            date: new Date(Date.UTC(2026, 9, 1 + i)),
            cours: new client_1.Prisma.Decimal(2900 + i),
        }));
        const { controleur, coursDu } = baseSimulee([
            { deviseId: 'usd', date: new Date(JOUR), cours: new client_1.Prisma.Decimal(2850) },
            ...plusTard,
        ]);
        await expect(controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), 'usd', { date: '2026-09-28', cours: 9999 })).rejects.toThrow(common_1.ConflictException);
        expect(coursDu(JOUR)).toBe('2850');
    });
    it('le jour encore vide · le gestionnaire le cote', async () => {
        const { controleur, coursDu } = baseSimulee([
            { deviseId: 'usd', date: new Date('2026-09-27T00:00:00.000Z'), cours: new client_1.Prisma.Decimal(2840) },
        ]);
        await controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), 'usd', { date: '2026-09-28', cours: 2850 });
        expect(coursDu(JOUR)).toBe('2850');
        expect(coursDu('2026-09-27T00:00:00.000Z')).toBe('2840');
    });
    it('le comptable garde la correction · son upsert réécrit le cours du jour', async () => {
        const { controleur, coursDu } = baseSimulee([
            { deviseId: 'usd', date: new Date(JOUR), cours: new client_1.Prisma.Decimal(2850) },
        ]);
        await controleur.poserCours(utilisateur(COMPTABLE), 'usd', { date: '2026-09-28', cours: 2855 });
        expect(coursDu(JOUR)).toBe('2855');
    });
    it('une autre panne de la base remonte telle quelle, jamais déguisée en « déjà coté »', async () => {
        const { prisma, controleur } = baseSimulee();
        const panne = new Error('connexion perdue');
        prisma.coursDevise.create.mockRejectedValueOnce(panne);
        await expect(controleur.poserCours(utilisateur(GESTIONNAIRE_PAIE), 'usd', { date: '2026-09-28', cours: 2850 })).rejects.toBe(panne);
    });
});
//# sourceMappingURL=cotation-gestionnaire-paie.spec.js.map