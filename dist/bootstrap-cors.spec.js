"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const bootstrap_1 = require("./bootstrap");
describe('optionsCors · le cache du contrôle préalable', () => {
    it('porte une durée de cache de deux heures, le plafond de Chrome', () => {
        expect(bootstrap_1.DUREE_CACHE_CONTROLE_CORS).toBe(7200);
        expect((0, bootstrap_1.optionsCors)(['https://oomega.web.app']).maxAge).toBe(7200);
        expect((0, bootstrap_1.optionsCors)(undefined).maxAge).toBe(7200);
    });
    it('ne relâche RIEN sur les origines · une liste reste une liste, credentials compris', () => {
        const o = (0, bootstrap_1.optionsCors)(['https://oomega.web.app', 'https://oomega.firebaseapp.com']);
        expect(o.origin).toEqual(['https://oomega.web.app', 'https://oomega.firebaseapp.com']);
        expect(o.credentials).toBe(true);
    });
    it('sans liste (développement seulement), l’origine appelante est reflétée, jamais « * »', () => {
        expect((0, bootstrap_1.optionsCors)(undefined).origin).toBe(true);
    });
    it('c’est bien cette fonction que le démarrage applique', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'bootstrap.ts'), 'utf-8');
        expect(source).toContain('app.enableCors(optionsCors(origines))');
    });
});
describe('le domaine du cabinet est une origine du site (2026-10-17)', () => {
    it('admis d’office par le serveur et par le workflow, comme les deux adresses Firebase', () => {
        const racine = (0, path_1.join)(__dirname, '..');
        expect((0, fs_1.readFileSync)((0, path_1.join)(racine, 'src/bootstrap.ts'), 'utf8')).toContain("'https://omegax.vmgconsulting.net'];");
        expect((0, fs_1.readFileSync)((0, path_1.join)(racine, '.github/workflows/deploy-cloud-run.yml'), 'utf8')).toContain('CORS_ORIGIN: https://oomega.web.app,https://oomega.firebaseapp.com,https://omegax.vmgconsulting.net');
    });
});
//# sourceMappingURL=bootstrap-cors.spec.js.map