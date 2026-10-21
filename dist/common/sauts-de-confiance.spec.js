"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const rxjs_1 = require("rxjs");
const audit_contexte_interceptor_1 = require("./audit/audit-contexte.interceptor");
const contexte_audit_1 = require("./audit/contexte-audit");
const sauts_de_confiance_1 = require("./sauts-de-confiance");
function ipVue(sauts, xff, pair = '10.0.0.9') {
    const app = express();
    app.set('trust proxy', sauts || false);
    const requete = Object.create(express.request);
    requete.app = app;
    requete.headers = xff === undefined ? {} : { 'x-forwarded-for': xff };
    requete.connection = requete.socket = { remoteAddress: pair };
    return requete.ip;
}
describe('F160 · le nombre de relais de confiance', () => {
    it('en ligne, deux relais · Firebase ajoute le client, Cloud Run ajoute Firebase', () => {
        expect((0, sauts_de_confiance_1.sautsDeConfiance)({})).toBe(sauts_de_confiance_1.SAUTS_EN_LIGNE);
        expect(sauts_de_confiance_1.SAUTS_EN_LIGNE).toBe(2);
        expect(ipVue((0, sauts_de_confiance_1.sautsDeConfiance)({}), '6.6.6.6, 41.0.0.7, 151.101.1.1')).toBe('41.0.0.7');
        expect(ipVue(1, '6.6.6.6, 41.0.0.7, 151.101.1.1')).toBe('151.101.1.1');
    });
    it('sur site, aucun relais · l’en-tête écrit par le poste appelant ne compte pas', () => {
        expect((0, sauts_de_confiance_1.sautsDeConfiance)({ MODE_INSTALLATION: 'SUR_SITE' })).toBe(0);
        expect(ipVue((0, sauts_de_confiance_1.sautsDeConfiance)({ MODE_INSTALLATION: 'SUR_SITE' }), '6.6.6.6', '192.168.1.20')).toBe('192.168.1.20');
    });
    it('la variable prime, zéro compris, et une valeur illisible arrête le démarrage', () => {
        expect((0, sauts_de_confiance_1.sautsDeConfiance)({ SAUTS_PROXY_CONFIANCE: '1' })).toBe(1);
        expect((0, sauts_de_confiance_1.sautsDeConfiance)({ SAUTS_PROXY_CONFIANCE: '0' })).toBe(0);
        expect((0, sauts_de_confiance_1.sautsDeConfiance)({ SAUTS_PROXY_CONFIANCE: '3', MODE_INSTALLATION: 'SUR_SITE' })).toBe(3);
        expect(() => (0, sauts_de_confiance_1.sautsDeConfiance)({ SAUTS_PROXY_CONFIANCE: 'deux' })).toThrow(/SAUTS_PROXY_CONFIANCE/);
        expect(() => (0, sauts_de_confiance_1.sautsDeConfiance)({ SAUTS_PROXY_CONFIANCE: '-1' })).toThrow(/SAUTS_PROXY_CONFIANCE/);
    });
});
describe('F160 · le journal d’audit note requete.ip, jamais la tête de X-Forwarded-For', () => {
    it('une adresse écrite par le client dans l’en-tête n’atteint pas le journal', async () => {
        let noteee = 'jamais lu';
        const requete = {
            user: { userId: 'u1', email: 'a@b.cd', tenantId: 't1', role: 'COMPTABLE' },
            headers: { 'x-forwarded-for': '6.6.6.6, 41.0.0.7, 151.101.1.1' },
            ip: '41.0.0.7',
        };
        const contexte = { switchToHttp: () => ({ getRequest: () => requete }) };
        const suite = {
            handle: () => {
                noteee = (0, contexte_audit_1.acteurCourant)()?.adresseIp;
                return (0, rxjs_1.of)(null);
            },
        };
        await (0, rxjs_1.lastValueFrom)(new audit_contexte_interceptor_1.AuditContexteInterceptor().intercept(contexte, suite));
        expect(noteee).toBe('41.0.0.7');
    });
});
describe('F160 · le démarrage pose le réglage de la règle, et lui seul', () => {
    function reglagePose(env) {
        const avant = { ...process.env };
        Object.assign(process.env, env);
        for (const [k, v] of Object.entries(env))
            if (v === undefined)
                delete process.env[k];
        const poses = {};
        const app = {
            use: () => undefined,
            getHttpAdapter: () => ({ getInstance: () => ({ set: (cle, valeur) => (poses[cle] = valeur) }) }),
            enableCors: () => undefined,
            useGlobalPipes: () => undefined,
        };
        try {
            require('../bootstrap').configurerApplication(app);
        }
        finally {
            for (const k of Object.keys(process.env))
                if (!(k in avant))
                    delete process.env[k];
            Object.assign(process.env, avant);
        }
        return poses['trust proxy'];
    }
    it('deux en ligne, false sur site · jamais 0, qu’Express lirait comme une valeur', () => {
        expect(reglagePose({ MODE_INSTALLATION: undefined, SAUTS_PROXY_CONFIANCE: undefined })).toBe(2);
        expect(reglagePose({ MODE_INSTALLATION: 'SUR_SITE', SAUTS_PROXY_CONFIANCE: undefined })).toBe(false);
    });
});
//# sourceMappingURL=sauts-de-confiance.spec.js.map