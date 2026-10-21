"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const session_constants_1 = require("./modules/auth/session.constants");
const RACINE = (0, path_1.join)(__dirname, '..');
const lire = (chemin) => (0, fs_1.readFileSync)((0, path_1.join)(RACINE, chemin), 'utf8');
describe('l’API servie sous l’adresse du site', () => {
    it('Firebase relaie /api/** vers le service Cloud Run, AVANT la règle de l’application', () => {
        const regles = JSON.parse(lire('client/firebase.json')).hosting.rewrites;
        const relais = regles.findIndex((r) => r.source === '/api/**');
        expect(relais).toBeGreaterThanOrEqual(0);
        expect(relais).toBeLessThan(regles.findIndex((r) => r.source === '**'));
        const deploiement = lire('.github/workflows/deploy-cloud-run.yml');
        expect(deploiement).toMatch(new RegExp(`SERVICE: ${regles[relais].run.serviceId}\\s`));
        expect(deploiement).toMatch(new RegExp(`REGION: ${regles[relais].run.region}\\s`));
    });
    it('le site publié appelle /api, jamais l’adresse de Cloud Run', () => {
        const env = lire('client/.env.production');
        expect(env).toMatch(/^VITE_API_URL=\/api$/m);
    });
    it('le cookie porte le seul nom que Firebase laisse passer', () => {
        expect(session_constants_1.COOKIE_SESSION).toBe('__session');
    });
    it('les tests navigateur passent par le même relais, et sous WebKit', () => {
        const w = lire('.github/workflows/tests-navigateur.yml');
        expect(w).toMatch(/VITE_API_URL: \/api\s/);
        expect(w).toMatch(/OMEGAX_API: http:\/\/localhost:4173\/api\s/);
        expect(w).toMatch(/PW_WEBKIT: '1'/);
        expect(w).toMatch(/playwright install --with-deps chromium webkit/);
        expect(lire('client/vite.config.ts')).toMatch(/'\/api': \{ target: process\.env\.OMEGAX_API_RELAIS/);
        expect((0, fs_1.existsSync)((0, path_1.join)(RACINE, 'client/vite.config.js'))).toBe(false);
        expect(JSON.parse(lire('client/tsconfig.node.json')).compilerOptions.outDir).toMatch(/node_modules/);
        const tsNode = JSON.parse(lire('client/tsconfig.node.json')).compilerOptions;
        const typesNode = (tsNode.types ?? []).includes('node');
        expect(typesNode || /declare const process:/.test(lire('client/vite.config.ts'))).toBe(true);
    });
    it('la surveillance interroge le chemin des clients, par le relais', () => {
        expect(lire('.github/workflows/surveillance.yml')).toMatch(/"\$URL_SANTE_RELAIS"/);
        expect(lire('.github/workflows/surveillance.yml')).toContain('https://oomega.web.app/api/health');
    });
});
describe('le cookie en http sur la machine même', () => {
    it('seul le http local perd Secure · la production le garde', () => {
        expect((0, session_constants_1.estHttpLocal)({ secure: false, hostname: 'localhost' })).toBe(true);
        expect((0, session_constants_1.estHttpLocal)({ secure: false, hostname: '127.0.0.1' })).toBe(true);
        expect((0, session_constants_1.estHttpLocal)({ secure: true, hostname: 'localhost' })).toBe(false);
        expect((0, session_constants_1.estHttpLocal)({ secure: false, hostname: 'oomega.web.app' })).toBe(false);
        expect((0, session_constants_1.estHttpLocal)(undefined)).toBe(false);
        expect((0, session_constants_1.optionsCookieSession)(false, false)).toBe(session_constants_1.OPTIONS_COOKIE_SESSION);
        expect((0, session_constants_1.optionsCookieSession)(false, true)).toMatchObject({ secure: false, sameSite: 'lax', httpOnly: true });
    });
});
//# sourceMappingURL=configuration-meme-origine.spec.js.map