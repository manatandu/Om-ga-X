"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const constants_1 = require("@nestjs/common/constants");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = require("bcryptjs");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const jwt_strategy_1 = require("./jwt.strategy");
const session_constants_1 = require("./session.constants");
const session_longue_1 = require("./session-longue");
const sortie_mot_de_passe_decorator_1 = require("../../common/decorators/sortie-mot-de-passe.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const double_authentification_1 = require("./double-authentification");
const jwt = new jwt_1.JwtService({ secret: 'secret-de-test', signOptions: { expiresIn: '8h' } });
const lireJeton = (jeton) => jwt.verify(jeton, { ignoreExpiration: true });
const T0 = Date.UTC(2026, 8, 1, 10, 0, 0);
const S0 = T0 / 1000;
const JOUR_MS = session_longue_1.SECONDES_PAR_JOUR * 1000;
describe('1 · la session courte, par défaut', () => {
    it('le cookie de base n’a ni durée ni échéance · fermé avec le navigateur', () => {
        expect(session_constants_1.OPTIONS_COOKIE_SESSION).not.toHaveProperty('maxAge');
        expect(session_constants_1.OPTIONS_COOKIE_SESSION).not.toHaveProperty('expires');
        expect(session_constants_1.OPTIONS_COOKIE_SESSION).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none' });
    });
    it('huit heures, comme avant F270, et aucune durée de cookie', () => {
        const e = (0, session_longue_1.emettreSession)(jwt, 'u1', { longue: false }, T0);
        const c = lireJeton(e.accessToken);
        expect(c.exp - c.iat).toBe(8 * 3600);
        expect(c.longue).toBeUndefined();
        expect(c.origine).toBe(S0);
        expect(e).toMatchObject({ sessionLongue: false, maxAgeMs: null });
    });
    it('une réémission garde l’échéance · pas huit heures neuves à la septième heure', () => {
        const debut = lireJeton((0, session_longue_1.emettreSession)(jwt, 'u1', { longue: false }, T0).accessToken);
        const session = (0, session_longue_1.sessionDuJeton)(debut, S0 + 7 * 3600);
        const reemis = lireJeton((0, session_longue_1.emettreSession)(jwt, 'u1', { longue: false, origine: session.origine, expCourte: session.exp }, T0 + 7 * 3600_000).accessToken);
        expect(reemis.exp).toBe(debut.exp);
        expect(reemis.origine).toBe(S0);
    });
});
describe('2 · la session longue', () => {
    it('neuve · sept jours, cookie de sept jours, marquée longue', () => {
        const e = (0, session_longue_1.emettreSession)(jwt, 'u1', { longue: true }, T0);
        const c = lireJeton(e.accessToken);
        expect(c.exp - c.iat).toBe(session_longue_1.DUREE_INACTIVITE_SESSION_LONGUE_S);
        expect(c).toMatchObject({ longue: true, origine: S0 });
        expect(e.maxAgeMs).toBe(session_longue_1.DUREE_INACTIVITE_SESSION_LONGUE_S * 1000);
    });
    it('prolongée au vingt-cinquième jour, elle s’arrête au trentième depuis l’ORIGINE', () => {
        const e = (0, session_longue_1.emettreSession)(jwt, 'u1', { longue: true, origine: S0 }, T0 + 25 * JOUR_MS);
        const c = lireJeton(e.accessToken);
        expect(c.exp).toBe(S0 + session_longue_1.DUREE_MAXIMALE_SESSION_LONGUE_S);
        expect(c.origine).toBe(S0);
        expect(e.maxAgeMs).toBe(5 * JOUR_MS);
    });
    it('la prolongation attend un jour, et cesse quand elle ne recule plus rien', () => {
        const longue = (iatS, expS) => (0, session_longue_1.sessionDuJeton)({ sub: 'u1', longue: true, origine: S0, iat: iatS, exp: expS }, iatS);
        expect((0, session_longue_1.prolongationDue)(longue(S0, S0 + 7 * session_longue_1.SECONDES_PAR_JOUR), S0 + 3600)).toBe(false);
        expect((0, session_longue_1.prolongationDue)(longue(S0, S0 + 7 * session_longue_1.SECONDES_PAR_JOUR), S0 + session_longue_1.SECONDES_PAR_JOUR)).toBe(true);
        const aLaBorne = longue(S0 + 24 * session_longue_1.SECONDES_PAR_JOUR, S0 + session_longue_1.DUREE_MAXIMALE_SESSION_LONGUE_S);
        expect((0, session_longue_1.prolongationDue)(aLaBorne, S0 + 26 * session_longue_1.SECONDES_PAR_JOUR)).toBe(false);
        const courte = (0, session_longue_1.sessionDuJeton)({ sub: 'u1', iat: S0, exp: S0 + 8 * 3600 }, S0);
        expect((0, session_longue_1.prolongationDue)(courte, S0 + 2 * session_longue_1.SECONDES_PAR_JOUR)).toBe(false);
    });
});
describe('2 bis · la prolongation par la stratégie et la garde', () => {
    const UTILISATEUR = {
        id: 'u1',
        tenantId: 't1',
        email: 'a@a.cd',
        role: 'COMPTABLE',
        estActif: true,
        estOperateurPlateforme: false,
        sessionsInvalidesAvant: null,
        doubleAuthActiveDepuis: null,
        tenant: { referentiel: 'SYCEBNL', licence: null },
    };
    const strategie = (u = UTILISATEUR) => new jwt_strategy_1.JwtStrategy({ getOrThrow: () => 'secret-de-test' }, { user: { findUnique: async () => u } }, jwt);
    const requete = (bearer = false) => ({
        method: 'GET',
        cookies: bearer ? {} : { [session_constants_1.COOKIE_SESSION]: 'jeton' },
        headers: bearer ? { authorization: 'Bearer jeton' } : {},
    });
    const maintenantS = () => Math.floor(Date.now() / 1000);
    it('un usage après un jour prolonge · origine et jeton CSRF recopiés', async () => {
        const origine = maintenantS() - 10 * session_longue_1.SECONDES_PAR_JOUR;
        const charge = { sub: 'u1', csrf: 'csrf-1', longue: true, origine, iat: maintenantS() - 2 * session_longue_1.SECONDES_PAR_JOUR, exp: maintenantS() + 5 * session_longue_1.SECONDES_PAR_JOUR };
        const req = requete();
        await strategie().validate(req, charge);
        const session = req[session_longue_1.CLE_SESSION_REQUETE];
        expect(session.prolongation).toBeDefined();
        const neuf = lireJeton(session.prolongation.accessToken);
        expect(neuf.origine).toBe(origine);
        expect(neuf.csrf).toBe('csrf-1');
        expect(neuf.longue).toBe(true);
        expect(neuf.exp - neuf.iat).toBe(session_longue_1.DUREE_INACTIVITE_SESSION_LONGUE_S);
        expect(session.prolongation.maxAgeMs).toBe(session_longue_1.DUREE_INACTIVITE_SESSION_LONGUE_S * 1000);
    });
    it('une révocation posée dans la seconde de la prolongation frappe le jeton prolongé (relecture adverse)', async () => {
        const origine = maintenantS() - 10 * session_longue_1.SECONDES_PAR_JOUR;
        const charge = {
            sub: 'u1',
            csrf: 'c',
            longue: true,
            origine,
            authentification: origine,
            iat: maintenantS() - 2 * session_longue_1.SECONDES_PAR_JOUR,
            exp: maintenantS() + 5 * session_longue_1.SECONDES_PAR_JOUR,
        };
        const req = requete();
        await strategie().validate(req, charge);
        const prolonge = lireJeton(req[session_longue_1.CLE_SESSION_REQUETE].prolongation.accessToken);
        expect(prolonge.authentification).toBe(origine);
        const revoque = { ...UTILISATEUR, sessionsInvalidesAvant: new Date(prolonge.iat * 1000 + 500) };
        await expect(strategie(revoque).validate(requete(), prolonge)).rejects.toThrow('Session close · reconnectez-vous');
        await expect(strategie().validate(requete(), prolonge)).resolves.toMatchObject({ userId: 'u1' });
    });
    it('pas avant un jour, et jamais pour un jeton porté par l’en-tête Authorization', async () => {
        const charge = { sub: 'u1', csrf: 'c', longue: true, origine: maintenantS(), iat: maintenantS() - 3600, exp: maintenantS() + 6 * session_longue_1.SECONDES_PAR_JOUR };
        const recente = requete();
        await strategie().validate(recente, charge);
        expect(recente[session_longue_1.CLE_SESSION_REQUETE].prolongation).toBeUndefined();
        const vieille = { ...charge, iat: maintenantS() - 2 * session_longue_1.SECONDES_PAR_JOUR };
        const parEntete = requete(true);
        await strategie().validate(parEntete, vieille);
        expect(parEntete[session_longue_1.CLE_SESSION_REQUETE].prolongation).toBeUndefined();
    });
    it('la garde pose le cookie prolongé une fois la requête ADMISE, et seulement alors', async () => {
        const garde = new jwt_auth_guard_1.JwtAuthGuard(new core_1.Reflector());
        const parent = Object.getPrototypeOf(jwt_auth_guard_1.JwtAuthGuard.prototype);
        jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
        const cookies = [];
        const contexte = (user, handler) => {
            const req = {
                user,
                method: 'GET',
                [session_longue_1.CLE_SESSION_REQUETE]: { longue: true, origine: 1, iat: 1, exp: 2, csrf: 'c', prolongation: { accessToken: 'prolonge', maxAgeMs: 42_000 } },
            };
            const res = { cookie: (...a) => cookies.push(a), req: { secure: true, hostname: 'oomega.web.app' } };
            return {
                switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
                getHandler: () => handler,
                getClass: () => class {
                },
            };
        };
        await expect(garde.canActivate(contexte({ role: client_1.RoleUtilisateur.COMPTABLE }, () => undefined))).resolves.toBe(true);
        expect(cookies).toHaveLength(1);
        const [nom, valeur, options] = cookies[0];
        expect([nom, valeur, options.maxAge, options.httpOnly]).toEqual([session_constants_1.COOKIE_SESSION, 'prolonge', 42_000, true]);
        cookies.length = 0;
        await expect(garde.canActivate(contexte({ role: client_1.RoleUtilisateur.GESTIONNAIRE_PAIE }, () => undefined))).rejects.toThrow();
        expect(cookies).toHaveLength(0);
        jest.restoreAllMocks();
    });
});
describe('3 · la console de l’éditeur, session longue admise, connexion complète exigée', () => {
    const service = (user) => new auth_service_1.AuthService({ user: { findUnique: async () => user, update: async () => ({}) } }, jwt, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    let hash;
    beforeAll(async () => {
        hash = await bcrypt.hash('le-bon', 4);
    });
    const compte = (estOperateurPlateforme) => ({
        id: 'u1',
        motDePasse: hash,
        estActif: true,
        estOperateurPlateforme,
        tentativesEchouees: 0,
        verrouilleJusqua: null,
        doubleAuthActiveDepuis: null,
    });
    it('case cochée · session longue pour un compte ordinaire', async () => {
        const r = await service(compte(false)).login({ email: 'a@b.cd', motDePasse: 'le-bon', resterConnecte: true });
        if ('deuxiemeFacteurRequis' in r)
            throw new Error('inattendu');
        expect(lireJeton(r.accessToken).longue).toBe(true);
        expect(r.sessionLongue).toBe(true);
    });
    it('case cochée · un opérateur reçoit aussi une session longue, sans avis', async () => {
        const r = await service(compte(true)).login({ email: 'a@b.cd', motDePasse: 'le-bon', resterConnecte: true });
        if ('deuxiemeFacteurRequis' in r)
            throw new Error('inattendu');
        expect(lireJeton(r.accessToken).longue).toBe(true);
        expect(r.sessionLongue).toBe(true);
        expect(r).not.toHaveProperty('motifSessionCourte');
    });
    it('case absente · session courte, pour tout le monde', async () => {
        const r = await service(compte(false)).login({ email: 'a@b.cd', motDePasse: 'le-bon' });
        if ('deuxiemeFacteurRequis' in r)
            throw new Error('inattendu');
        expect(r).toMatchObject({ sessionLongue: false, maxAgeMs: null });
    });
    it('un jeton long porté par un opérateur passe la stratégie, et la session garde sa dernière authentification', async () => {
        const operateur = { ...compte(true), tenantId: 't1', email: 'a@b.cd', role: 'ADMIN_CABINET', sessionsInvalidesAvant: null, tenant: { referentiel: 'SYCEBNL', licence: null } };
        const s = new jwt_strategy_1.JwtStrategy({ getOrThrow: () => 'x' }, { user: { findUnique: async () => operateur } }, jwt);
        const req = { method: 'GET', cookies: { [session_constants_1.COOKIE_SESSION]: 'j' }, headers: {} };
        const maintenant = Math.floor(Date.now() / 1000);
        await expect(s.validate(req, { sub: 'u1', longue: true, origine: maintenant - 3 * session_longue_1.SECONDES_PAR_JOUR, authentification: maintenant - 3 * session_longue_1.SECONDES_PAR_JOUR, iat: maintenant })).resolves.toMatchObject({ userId: 'u1', estOperateurPlateforme: true });
        expect(req[session_longue_1.CLE_SESSION_REQUETE].authentification).toBe(maintenant - 3 * session_longue_1.SECONDES_PAR_JOUR);
    });
    it('la connexion pose la connexion complète ; un changement de mot de passe la RECOPIE, et la console reste fermée', async () => {
        const maintenant = Math.floor(Date.now() / 1000);
        const r = await service(compte(true)).login({ email: 'a@b.cd', motDePasse: 'le-bon', resterConnecte: true });
        if ('deuxiemeFacteurRequis' in r)
            throw new Error('inattendu');
        expect(lireJeton(r.accessToken).connexionComplete).toBeGreaterThanOrEqual(maintenant);
        const ilYATroisJours = maintenant - 3 * session_longue_1.SECONDES_PAR_JOUR;
        const change = await service(compte(true)).changerMotDePasse('u1', 'le-bon', 'nouveau-tres-long', {
            longue: true,
            origine: ilYATroisJours,
            iat: maintenant - 60,
            exp: maintenant + 3600,
            csrf: 'c',
            authentification: ilYATroisJours,
            connexionComplete: ilYATroisJours,
        });
        const jeton = lireJeton(change.accessToken);
        expect(jeton.authentification).toBeGreaterThanOrEqual(maintenant);
        expect(jeton.connexionComplete).toBe(ilYATroisJours);
        expect((0, session_longue_1.authentificationTropAnciennePourLaConsole)((0, session_longue_1.sessionDuJeton)(jeton, maintenant), maintenant)).toBe(true);
    });
    it('changer d’adresse ou déconnecter les autres appareils recopie aussi la connexion complète', async () => {
        const maintenant = Math.floor(Date.now() / 1000);
        const ilYATroisJours = maintenant - 3 * session_longue_1.SECONDES_PAR_JOUR;
        const session = {
            longue: true,
            origine: ilYATroisJours,
            iat: maintenant - 60,
            exp: maintenant + 3600,
            csrf: 'c',
            authentification: ilYATroisJours,
            connexionComplete: ilYATroisJours,
        };
        const s = service(compte(true));
        const actes = [
            () => s.changerAdresse('u1', 'le-bon', 'neuve@b.cd', session),
            () => s.deconnecterAutresAppareils('u1', 'le-bon', session),
        ];
        for (const acte of actes) {
            const r = (await acte());
            expect(lireJeton(r.accessToken).connexionComplete).toBe(ilYATroisJours);
        }
        expect((0, session_longue_1.demandeDeReemission)(session).connexionComplete).toBe(ilYATroisJours);
    });
    it('la prolongation recopie la connexion complète, et un jeton qui ne la porte pas ne l’invente pas', () => {
        expect((0, session_longue_1.sessionDuJeton)({ sub: 'u1', iat: S0, authentification: S0 }, S0).connexionComplete).toBeNull();
        const prolonge = (0, session_longue_1.emettreSession)(jwt, 'u1', { longue: true, origine: S0, csrf: 'c', authentification: S0, connexionComplete: S0 }, (S0 + session_longue_1.SECONDES_PAR_JOUR) * 1000);
        expect(lireJeton(prolonge.accessToken).connexionComplete).toBe(S0);
    });
    it('la réémission d’un opérateur garde sa session longue', async () => {
        const r = await service(compte(true)).changerMotDePasse('u1', 'le-bon', 'nouveau-tres-long', {
            longue: true,
            origine: S0,
            iat: S0,
            exp: S0 + 3600,
            csrf: 'c',
        });
        expect(lireJeton(r.accessToken).longue).toBe(true);
    });
});
describe('la case voyage avec le code du second facteur · aucun état n’est gardé', () => {
    it('sans la case au second appel, la session est courte · avec, elle est longue', async () => {
        const secret = (0, double_authentification_1.base32)(Buffer.from('12345678901234567890'));
        const hash = await bcrypt.hash('le-bon', 4);
        const service = () => new auth_service_1.AuthService({
            user: {
                findUnique: async () => ({
                    id: 'u1',
                    motDePasse: hash,
                    estActif: true,
                    estOperateurPlateforme: false,
                    tentativesEchouees: 0,
                    verrouilleJusqua: null,
                    secretDoubleAuth: secret,
                    doubleAuthActiveDepuis: new Date('2026-01-01T00:00:00Z'),
                    dernierPasDoubleAuth: null,
                    codesSecoursDoubleAuth: [],
                }),
                update: async () => ({}),
            },
        }, jwt, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
        const code = (0, double_authentification_1.codeHotp)((0, double_authentification_1.depuisBase32)(secret), (0, double_authentification_1.pasDe)(Date.now()));
        await expect(service().login({ email: 'a@b.cd', motDePasse: 'le-bon', resterConnecte: true })).resolves.toEqual({
            deuxiemeFacteurRequis: true,
        });
        const sansCase = await service().login({ email: 'a@b.cd', motDePasse: 'le-bon', code });
        const avecCase = await service().login({ email: 'a@b.cd', motDePasse: 'le-bon', code, resterConnecte: true });
        if ('deuxiemeFacteurRequis' in sansCase || 'deuxiemeFacteurRequis' in avecCase)
            throw new Error('inattendu');
        expect([sansCase.sessionLongue, avecCase.sessionLongue]).toEqual([false, true]);
    });
});
describe('4 · déconnecter mes autres appareils', () => {
    const service = (capture, hash) => new auth_service_1.AuthService({
        user: {
            findUnique: async () => ({ id: 'u1', motDePasse: hash, estOperateurPlateforme: false }),
            update: async ({ data }) => {
                capture.data = data;
                return {};
            },
        },
    }, jwt, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    const MAINTENANT = new Date(T0 + 12 * JOUR_MS + 400);
    const SESSION = { longue: true, origine: S0, iat: S0 + 11 * session_longue_1.SECONDES_PAR_JOUR, exp: S0 + 18 * session_longue_1.SECONDES_PAR_JOUR, csrf: 'ancien' };
    it('exige le mot de passe actuel, sans rien écrire sinon', async () => {
        const capture = {};
        const hash = await bcrypt.hash('le-bon', 4);
        await expect(service(capture, hash).deconnecterAutresAppareils('u1', 'faux', SESSION, MAINTENANT)).rejects.toThrow(/mot de passe actuel est incorrect/);
        expect(capture.data).toBeUndefined();
    });
    it('ferme les autres sessions à cet instant et garde celle-ci, son régime et son origine', async () => {
        const capture = {};
        const hash = await bcrypt.hash('le-bon', 4);
        const r = await service(capture, hash).deconnecterAutresAppareils('u1', 'le-bon', SESSION, MAINTENANT);
        expect(capture.data).toEqual({ sessionsInvalidesAvant: MAINTENANT });
        const neuf = lireJeton(r.accessToken);
        expect(neuf).toMatchObject({ longue: true, origine: S0 });
        expect((0, jwt_strategy_1.sessionRevoquee)(neuf.iat, MAINTENANT)).toBe(false);
        expect((0, jwt_strategy_1.sessionRevoquee)(neuf.iat - 1, MAINTENANT)).toBe(true);
        expect(neuf.authentification).toBe(neuf.iat);
        const strategie = new jwt_strategy_1.JwtStrategy({ getOrThrow: () => 'secret-de-test' }, {
            user: {
                findUnique: async () => ({
                    id: 'u1',
                    tenantId: 't1',
                    email: 'a@a.cd',
                    role: 'COMPTABLE',
                    estActif: true,
                    estOperateurPlateforme: false,
                    sessionsInvalidesAvant: MAINTENANT,
                    doubleAuthActiveDepuis: null,
                    tenant: { referentiel: 'SYCEBNL', licence: null },
                }),
            },
        }, jwt);
        const req = { method: 'GET', cookies: {}, headers: { authorization: 'Bearer j' } };
        await expect(strategie.validate(req, neuf)).resolves.toMatchObject({ userId: 'u1' });
        await expect(strategie.validate(req, { ...neuf, authentification: neuf.iat - 1 })).rejects.toThrow('Session close');
        expect(r.maxAgeMs).toBe(session_longue_1.DUREE_INACTIVITE_SESSION_LONGUE_S * 1000);
        expect(r.csrfToken).not.toBe('ancien');
    });
    it('une session courte le reste, avec son échéance', async () => {
        const capture = {};
        const hash = await bcrypt.hash('le-bon', 4);
        const courte = { longue: false, origine: S0, iat: S0, exp: S0 + 8 * 3600, csrf: 'c' };
        const r = await service(capture, hash).deconnecterAutresAppareils('u1', 'le-bon', courte, new Date(T0 + 3600_000));
        expect(r.maxAgeMs).toBeNull();
        expect(lireJeton(r.accessToken).exp).toBe(S0 + 8 * 3600);
    });
    it('le changement de mot de passe garde lui aussi le régime · « Rester connecté » ne se perd pas', async () => {
        const hash = await bcrypt.hash('le-bon', 4);
        const r = await service({}, hash).changerMotDePasse('u1', 'le-bon', 'nouveau-tres-long', SESSION);
        expect(lireJeton(r.accessToken)).toMatchObject({ longue: true, origine: S0 });
    });
});
describe('le contrôleur · un seul chemin pour le cookie, et la route nouvelle', () => {
    const reponse = () => {
        const cookies = [];
        return { cookies, res: { cookie: (...a) => cookies.push(a), req: { secure: true, hostname: 'oomega.web.app' } } };
    };
    it('session longue · cookie à durée ; courte · cookie de session ; le corps ne porte ni jeton ni durée', async () => {
        for (const [maxAgeMs, attendu] of [
            [604_800_000, 604_800_000],
            [null, undefined],
        ]) {
            const { cookies, res } = reponse();
            const c = new auth_controller_1.AuthController({ login: async () => ({ accessToken: 'jwt', csrfToken: 'csrf', sessionLongue: maxAgeMs !== null, maxAgeMs }) }, { get: () => undefined });
            const corps = await c.login({ email: 'a@a.cd', motDePasse: 'x' }, res);
            expect(corps).toEqual({ csrfToken: 'csrf', sessionLongue: maxAgeMs !== null });
            const [nom, valeur, options] = cookies[0];
            expect([nom, valeur, options.maxAge, options.expires]).toEqual([session_constants_1.COOKIE_SESSION, 'jwt', attendu, undefined]);
        }
    });
    it('/auth/me rend le jeton CSRF de la session en cours · il suit la session', async () => {
        const c = new auth_controller_1.AuthController({ me: async () => ({ id: 'u1' }) }, { get: () => undefined });
        const req = { [session_longue_1.CLE_SESSION_REQUETE]: { longue: true, origine: 1, iat: 1, exp: 2, csrf: 'csrf-du-jeton' } };
        await expect(c.me({ userId: 'u1' }, req)).resolves.toEqual({
            id: 'u1',
            csrfToken: 'csrf-du-jeton',
            sessionLongue: true,
        });
    });
    it('la route passe la session de la requête au service et pose le cookie rendu', async () => {
        const appels = [];
        const { cookies, res } = reponse();
        const session = { longue: true, origine: 5, iat: 5, exp: 9, csrf: 'c' };
        res.req[session_longue_1.CLE_SESSION_REQUETE] = session;
        const c = new auth_controller_1.AuthController({
            deconnecterAutresAppareils: async (...a) => {
                appels.push(a);
                return { autresAppareilsDeconnectes: true, accessToken: 'neuf', csrfToken: 'csrf-neuf', sessionLongue: true, maxAgeMs: 1000 };
            },
        }, { get: () => undefined });
        const corps = await c.deconnecterAutresAppareils({ userId: 'u1' }, { motDePasseActuel: 'le-bon' }, res);
        expect(appels).toEqual([['u1', 'le-bon', session]]);
        expect(corps).toEqual({ autresAppareilsDeconnectes: true, csrfToken: 'csrf-neuf', sessionLongue: true });
        expect(cookies[0].slice(0, 2)).toEqual([session_constants_1.COOKIE_SESSION, 'neuf']);
    });
    it('chaque route qui éprouve un secret porte la garde et le débit de la connexion (audit de cohérence du lot F270)', () => {
        const proto = auth_controller_1.AuthController.prototype;
        const eprouventUnSecret = [
            'changerMotDePasse',
            'changerAdresse',
            'activerDoubleAuth',
            'desactiverDoubleAuth',
            'regenererCodesSecours',
            'deconnecterAutresAppareils',
        ];
        for (const m of [...eprouventUnSecret, 'login']) {
            expect([m, Reflect.getMetadata('THROTTLER:LIMITdefault', proto[m]), Reflect.getMetadata('THROTTLER:TTLdefault', proto[m])]).toEqual([
                m,
                20,
                60_000,
            ]);
        }
        const sansGarde = Object.getOwnPropertyNames(proto)
            .filter((m) => m !== 'constructor' && Reflect.getMetadata(constants_1.PATH_METADATA, proto[m]) !== undefined)
            .filter((m) => !(Reflect.getMetadata(constants_1.GUARDS_METADATA, proto[m]) ?? []).includes(jwt_auth_guard_1.JwtAuthGuard))
            .sort();
        expect(sansGarde).toEqual(['etatInscriptionEssai', 'inscrireEnEssai', 'login', 'logout', 'register']);
    });
    it('la route est ouverte à tous les rôles, et n’est PAS une sortie de mot de passe provisoire', () => {
        const route = auth_controller_1.AuthController.prototype.deconnecterAutresAppareils;
        expect(Reflect.getMetadata(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, route)).toEqual({ gestionnairePaie: true });
        expect(Reflect.getMetadata(sortie_mot_de_passe_decorator_1.CLE_SORTIE_MOT_DE_PASSE, auth_controller_1.AuthController.prototype.deconnecterPartout)).toBe(true);
        expect(Reflect.getMetadata(sortie_mot_de_passe_decorator_1.CLE_SORTIE_MOT_DE_PASSE, route)).toBeUndefined();
    });
});
//# sourceMappingURL=session-longue.spec.js.map