"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pooling_base_1 = require("./pooling-base");
const POOLEE = 'postgresql://utilisateur:MOTDEPASSE@ep-exemple-123-pooler.us-east-1.aws.neon.tech/base?sslmode=require&pgbouncer=true&connection_limit=10';
const DIRECTE = 'postgresql://utilisateur:MOTDEPASSE@ep-exemple-123.us-east-1.aws.neon.tech/base?sslmode=require';
describe('état du pooling · lecture de la chaîne de connexion', () => {
    it('reconnaît un endpoint poolé, son pgbouncer et son plafond', () => {
        expect((0, pooling_base_1.lireEtatDuPooling)(POOLEE)).toEqual({ poole: true, pgbouncerDeclare: true, plafondConnexions: 10 });
    });
    it('reconnaît un endpoint direct et l’absence de plafond', () => {
        expect((0, pooling_base_1.lireEtatDuPooling)(DIRECTE)).toEqual({ poole: false, pgbouncerDeclare: false, plafondConnexions: null });
    });
    it('rend null sur une chaîne absente ou illisible · ce n’est pas à elle de faire échouer un démarrage', () => {
        expect((0, pooling_base_1.lireEtatDuPooling)(undefined)).toBeNull();
        expect((0, pooling_base_1.lireEtatDuPooling)('')).toBeNull();
        expect((0, pooling_base_1.lireEtatDuPooling)('pas une url')).toBeNull();
    });
});
describe('message de démarrage · il informe sans rien divulguer', () => {
    it.each([POOLEE, DIRECTE])('ne laisse fuir ni mot de passe, ni hôte, ni utilisateur', (chaine) => {
        const message = (0, pooling_base_1.messageDePooling)((0, pooling_base_1.lireEtatDuPooling)(chaine));
        for (const secret of ['MOTDEPASSE', 'utilisateur', 'neon.tech', 'ep-exemple-123', '/base']) {
            expect(message).not.toContain(secret);
        }
    });
    it('dit le régime de connexion et le plafond', () => {
        expect((0, pooling_base_1.messageDePooling)((0, pooling_base_1.lireEtatDuPooling)(POOLEE))).toBe('Base · endpoint POOLÉ, plafond de connexions 10 par instance');
        expect((0, pooling_base_1.messageDePooling)((0, pooling_base_1.lireEtatDuPooling)(DIRECTE))).toBe('Base · endpoint DIRECT (non poolé), plafond de connexions défaut Prisma');
    });
    it('AVERTIT quand un endpoint poolé n’a pas pgbouncer=true', () => {
        const sansPgbouncer = POOLEE.replace('&pgbouncer=true', '');
        expect((0, pooling_base_1.messageDePooling)((0, pooling_base_1.lireEtatDuPooling)(sansPgbouncer))).toContain('ATTENTION : pgbouncer=true absent');
    });
    it('le dit quand la chaîne manque, plutôt que de se taire', () => {
        expect((0, pooling_base_1.messageDePooling)(null)).toBe('Base · chaîne de connexion absente ou illisible');
    });
});
//# sourceMappingURL=pooling-base.spec.js.map