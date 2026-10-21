"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
function controleurs(dossier) {
    return (0, fs_1.readdirSync)(dossier, { withFileTypes: true }).flatMap((e) => {
        const chemin = (0, path_1.join)(dossier, e.name);
        if (e.isDirectory())
            return controleurs(chemin);
        return e.name.endsWith('.controller.ts') ? [chemin] : [];
    });
}
describe('corps de requête', () => {
    const fichiers = controleurs((0, path_1.join)(__dirname, '..'));
    it('le recensement trouve des contrôleurs', () => {
        expect(fichiers.length).toBeGreaterThan(30);
    });
    it('aucun @Body() n’est typé par un type littéral', () => {
        const fautifs = fichiers.flatMap((f) => [...(0, fs_1.readFileSync)(f, 'utf8').matchAll(/@Body\(\)\s+\w+\??:\s*\{/g)].map(() => f.split('/src/')[1]));
        expect(fautifs).toEqual([]);
    });
});
//# sourceMappingURL=corps-types-par-classe.spec.js.map