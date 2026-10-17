"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const jwt_strategy_1 = require("./jwt.strategy");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const session_constants_1 = require("./session.constants");
const UTILISATEUR = {
    id: 'u1',
    tenantId: 't1',
    email: 'a@a.cd',
    role: 'ADMIN_CABINET',
    estActif: true,
    estOperateurPlateforme: false,
    tenant: { referentiel: 'SYCEBNL', licence: null },
};
const strategie = () => new jwt_strategy_1.JwtStrategy({ getOrThrow: () => 'secret-de-test' }, { user: { findUnique: async () => UTILISATEUR } });
const requete = (options) => ({
    method: options.method,
    cookies: options.cookie ? { [session_constants_1.COOKIE_SESSION]: 'jeton' } : {},
    headers: {
        ...(options.bearer ? { authorization: 'Bearer jeton' } : {}),
        ...(options.csrf !== undefined ? { 'x-csrf-token': options.csrf } : {}),
    },
});
describe('JwtStrategy · contrôle CSRF sur le cookie de session', () => {
    const charge = { sub: 'u1', csrf: 'abc123' };
    it('une lecture portée par le cookie passe sans en-tête CSRF', async () => {
        const u = await strategie().validate(requete({ method: 'GET', cookie: true }), charge);
        expect(u.userId).toBe('u1');
    });
    it('une mutation portée par le cookie exige l’en-tête apparié · absent ou faux, refus', async () => {
        await expect(strategie().validate(requete({ method: 'POST', cookie: true }), charge)).rejects.toThrow(common_1.ForbiddenException);
        await expect(strategie().validate(requete({ method: 'DELETE', cookie: true, csrf: 'autre' }), charge)).rejects.toThrow(common_1.ForbiddenException);
        const u = await strategie().validate(requete({ method: 'POST', cookie: true, csrf: 'abc123' }), charge);
        expect(u.userId).toBe('u1');
    });
    it('une mutation authentifiée par Authorization est exemptée · un en-tête personnalisé ne se forge pas inter-site', async () => {
        const u = await strategie().validate(requete({ method: 'POST', bearer: true }), charge);
        expect(u.userId).toBe('u1');
    });
    it('un jeton d’avant la migration (sans claim csrf) est refusé sur une mutation cookie', async () => {
        await expect(strategie().validate(requete({ method: 'POST', cookie: true, csrf: 'abc123' }), { sub: 'u1' })).rejects.toThrow(common_1.ForbiddenException);
    });
    it('extraireJetonDuCookie lit le cookie de session, et rien d’autre', () => {
        expect((0, jwt_strategy_1.extraireJetonDuCookie)({ cookies: { [session_constants_1.COOKIE_SESSION]: 'x' } })).toBe('x');
        expect((0, jwt_strategy_1.extraireJetonDuCookie)({ cookies: {} })).toBeNull();
        expect((0, jwt_strategy_1.extraireJetonDuCookie)({})).toBeNull();
    });
});
describe('AuthService · jeton CSRF apparié au jeton de session', () => {
    it('login émet un JWT dont le claim csrf égale le csrfToken renvoyé', async () => {
        let payload;
        const hash = await bcrypt.hash('mot-de-passe-correct', 4);
        const s = new auth_service_1.AuthService({ user: { findUnique: async () => ({ id: 'u1', motDePasse: hash, estActif: true }) } }, { sign: (p) => ((payload = p), 'jwt-signe') }, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
        const resultat = await s.login({ email: 'a@a.cd', motDePasse: 'mot-de-passe-correct' });
        if ('deuxiemeFacteurRequis' in resultat)
            throw new Error('second facteur inattendu');
        expect(resultat.csrfToken).toBe(payload.csrf);
        expect(resultat.csrfToken).toMatch(/^[0-9a-f]{32}$/);
        expect(resultat.accessToken).toBe('jwt-signe');
    });
});
describe('AuthController · le jeton de session ne sort que par le cookie', () => {
    const reponse = () => {
        const appels = [];
        return {
            appels,
            res: {
                cookie: (...args) => appels.push({ nom: 'cookie', args }),
                clearCookie: (...args) => appels.push({ nom: 'clearCookie', args }),
            },
        };
    };
    it('login pose le cookie httpOnly et le corps ne porte que le jeton CSRF', async () => {
        const { appels, res } = reponse();
        const controleur = new auth_controller_1.AuthController({
            login: async () => ({ accessToken: 'jwt-secret', csrfToken: 'csrf-1' }),
        }, { get: () => undefined });
        const corps = await controleur.login({ email: 'a@a.cd', motDePasse: 'x' }, res);
        expect(corps).toEqual({ csrfToken: 'csrf-1' });
        expect(corps).not.toHaveProperty('accessToken');
        const [nomCookie, valeur, options] = appels[0].args;
        expect(nomCookie).toBe(session_constants_1.COOKIE_SESSION);
        expect(valeur).toBe('jwt-secret');
        expect(options.httpOnly).toBe(true);
        expect(options.secure).toBe(true);
        expect(options.sameSite).toBe('none');
    });
    it('logout efface le cookie de session', async () => {
        const { appels, res } = reponse();
        const controleur = new auth_controller_1.AuthController({}, { get: () => undefined });
        await controleur.logout(res);
        expect(appels[0].nom).toBe('clearCookie');
        expect(appels[0].args[0]).toBe(session_constants_1.COOKIE_SESSION);
    });
});
describe('AuthController · auto-inscription fermée (option A)', () => {
    const res = { cookie: () => undefined, clearCookie: () => undefined };
    it('refuse /auth/register par défaut · un dossier naît depuis la console VMG, pas tout seul', async () => {
        let registerAppele = false;
        const controleur = new auth_controller_1.AuthController({
            register: async () => {
                registerAppele = true;
                return { accessToken: 'x', csrfToken: 'y' };
            },
        }, { get: () => undefined });
        await expect(controleur.register({}, res)).rejects.toThrow(/VMG Consulting/);
        expect(registerAppele).toBe(false);
    });
    it("INSCRIPTION_PUBLIQUE=true rouvre la porte · fermée à clé, pas démolie", async () => {
        const controleur = new auth_controller_1.AuthController({ register: async () => ({ accessToken: 'x', csrfToken: 'y' }) }, { get: (cle) => (cle === 'INSCRIPTION_PUBLIQUE' ? 'true' : undefined) });
        await expect(controleur.register({}, res)).resolves.toEqual({ csrfToken: 'y' });
    });
});
describe('la double authentification voyage avec l’utilisateur relu', () => {
    const avec = (doubleAuthActiveDepuis) => new jwt_strategy_1.JwtStrategy({ getOrThrow: () => 'secret-de-test' }, { user: { findUnique: async () => ({ ...UTILISATEUR, doubleAuthActiveDepuis }) } });
    it('active seulement si une date d’activation est posée', async () => {
        const req = { method: 'GET', cookies: {}, headers: { authorization: 'Bearer jeton' } };
        await expect(avec(null).validate(req, { sub: 'u1' })).resolves.toMatchObject({ doubleAuthentificationActive: false });
        await expect(avec(new Date()).validate(req, { sub: 'u1' })).resolves.toMatchObject({ doubleAuthentificationActive: true });
    });
});
//# sourceMappingURL=session-cookie.spec.js.map