"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const filtre_pannes_1 = require("./filtre-pannes");
const telemetrie_serveur_1 = require("./telemetrie-serveur");
const DSN = 'https://cle@o1.ingest.de.sentry.io/2';
function doublure() {
    const appels = { init: [], capture: [] };
    const integration = (nom) => (opts) => ({ name: nom, opts });
    const sdk = {
        init: (o) => appels.init.push(o),
        captureException: (e, c) => appels.capture.push({ e, c }),
        onUncaughtExceptionIntegration: integration('OnUncaughtException'),
        onUnhandledRejectionIntegration: integration('OnUnhandledRejection'),
        linkedErrorsIntegration: integration('LinkedErrors'),
        dedupeIntegration: integration('Dedupe'),
    };
    return { sdk: sdk, appels };
}
afterEach(() => (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({}, () => doublure().sdk));
describe('démarrage · le SDK ne se charge que si le régime est actif', () => {
    it('sans clé, rien n’est chargé', () => {
        let charge = false;
        const r = (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({}, () => ((charge = true), doublure().sdk));
        expect(r).toEqual({ actif: false, motif: 'aucune-cle' });
        expect(charge).toBe(false);
    });
    it('sur site, rien n’est chargé, même avec une clé', () => {
        let charge = false;
        const r = (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({ SENTRY_DSN: DSN, MODE_INSTALLATION: 'SUR_SITE' }, () => ((charge = true), doublure().sdk));
        expect(r).toEqual({ actif: false, motif: 'sur-site' });
        expect(charge).toBe(false);
    });
    it('un SDK qui échoue au chargement n’empêche pas le démarrage, et le régime le dit', () => {
        const r = (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({ SENTRY_DSN: DSN }, () => {
            throw new Error('module introuvable');
        });
        expect(r).toEqual({ actif: false, motif: 'echec' });
        expect(() => (0, telemetrie_serveur_1.signalerPanneServeur)(new Error('x'), {})).not.toThrow();
    });
    it('actif · aucune intégration par défaut, collecte coupée, aucune trace, nettoyage branché', () => {
        const { sdk, appels } = doublure();
        expect((0, telemetrie_serveur_1.demarrerTelemetrieServeur)({ SENTRY_DSN: DSN, K_REVISION: 'rev-1' }, () => sdk)).toEqual({ actif: true });
        const o = appels.init[0];
        expect(o.dsn).toBe(DSN);
        expect(o.defaultIntegrations).toBe(false);
        expect(o.integrations.map((i) => i.name)).toEqual([
            'OnUncaughtException',
            'OnUnhandledRejection',
            'LinkedErrors',
            'Dedupe',
        ]);
        expect(o.integrations[1].opts).toEqual({ mode: 'strict' });
        expect('tracesSampleRate' in o).toBe(false);
        expect(o.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] });
        expect(o.beforeSend({ exception: { values: [{ type: 'Error', value: 'x' }] }, user: { email: 'a@b.cd' } })).not.toHaveProperty('user');
        expect(o.beforeBreadcrumb({ category: 'ui.click', message: '5000' })).toBeNull();
        expect(o.release).toBe('rev-1');
    });
});
describe('filtre des pannes · un 5xx part, un refus jamais', () => {
    function hote(route = '/comptes/:id') {
        const reponse = { statut: 0 };
        return {
            getType: () => 'http',
            switchToHttp: () => ({ getRequest: () => ({ method: 'POST', route: { path: route }, path: '/comptes/3f2b8c1e' }) }),
            getArgByIndex: () => reponse,
            getArgs: () => [],
        };
    }
    function filtre() {
        const f = new filtre_pannes_1.FiltrePannes();
        f.httpAdapterHost = {
            httpAdapter: { isHeadersSent: () => false, reply: () => undefined, end: () => undefined },
        };
        return f;
    }
    it('le statut lu est celui que Nest rendra', () => {
        expect((0, filtre_pannes_1.statutDe)(new common_1.BadRequestException())).toBe(400);
        expect((0, filtre_pannes_1.statutDe)(new common_1.ServiceUnavailableException())).toBe(503);
        expect((0, filtre_pannes_1.statutDe)(Object.assign(new Error('trop gros'), { statusCode: 413 }))).toBe(413);
        expect((0, filtre_pannes_1.statutDe)(new Error('défaut'))).toBe(500);
        expect((0, filtre_pannes_1.statutDe)(undefined)).toBe(500);
    });
    it('une erreur inattendue est signalée avec le MOTIF de la route, jamais l’adresse appelée', () => {
        const { sdk, appels } = doublure();
        (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({ SENTRY_DSN: DSN }, () => sdk);
        const erreur = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        filtre().catch(erreur, hote());
        expect(appels.capture).toHaveLength(1);
        expect(appels.capture[0].c).toEqual({
            tags: { route: '/comptes/:id', methode: 'POST', statut: '500', code_prisma: 'P2002' },
        });
    });
    it('un refus (4xx) ne part pas', () => {
        const { sdk, appels } = doublure();
        (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({ SENTRY_DSN: DSN }, () => sdk);
        filtre().catch(new common_1.BadRequestException('Montant refusé'), hote());
        filtre().catch(new common_1.ForbiddenException(), hote());
        expect(appels.capture).toHaveLength(0);
    });
    it('inactif, le filtre répond sans rien signaler', () => {
        (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({}, () => doublure().sdk);
        expect(() => filtre().catch(new Error('x'), hote())).not.toThrow();
    });
    it('un signalement qui échoue ne fait jamais tomber la réponse', () => {
        const { sdk } = doublure();
        sdk.captureException = () => {
            throw new Error('réseau');
        };
        (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({ SENTRY_DSN: DSN }, () => sdk);
        expect(() => (0, telemetrie_serveur_1.signalerPanneServeur)(new Error('x'), { statut: '500' })).not.toThrow();
    });
});
describe('câblage', () => {
    const lire = (f) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', '..', f), 'utf8');
    it('le filtre est global, et le régime s’écrit avant la création de l’application', () => {
        expect(lire('app.module.ts')).toContain('{ provide: APP_FILTER, useClass: FiltrePannes }');
        const main = lire('main.ts');
        const corps = main.slice(main.indexOf('async function bootstrap'));
        expect(corps.indexOf('demarrerTelemetrieServeur()')).toBeGreaterThan(0);
        expect(corps.indexOf('demarrerTelemetrieServeur()')).toBeLessThan(corps.indexOf('NestFactory.create'));
    });
    it('aucun fichier du serveur ne tire les TYPES du SDK dans la compilation (2026-10-08)', () => {
        const { readdirSync, statSync } = require('fs');
        const parcourir = (d) => readdirSync(d).flatMap((n) => {
            const c = (0, path_1.join)(d, n);
            return statSync(c).isDirectory() ? parcourir(c) : n.endsWith('.ts') ? [c] : [];
        });
        const fautifs = parcourir((0, path_1.join)(__dirname, '..', '..')).filter((f) => {
            const code = (0, fs_1.readFileSync)(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            return /from '@sentry\/|import\('@sentry\//.test(code);
        });
        expect(fautifs).toEqual([]);
    });
    it('aucun fichier du serveur n’importe le SDK en tête · il se charge à la demande', () => {
        const source = lire('common/telemetrie/telemetrie-serveur.ts');
        expect(source).not.toMatch(/^import [^;]*from '@sentry\/node'/m);
        expect(source).toContain("require('@sentry/node')");
    });
});
//# sourceMappingURL=telemetrie-serveur.spec.js.map