"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
function fichiersTs(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
        const chemin = (0, path_1.join)(dossier, nom);
        return (0, fs_1.statSync)(chemin).isDirectory() ? fichiersTs(chemin) : nom.endsWith('.ts') ? [chemin] : [];
    });
}
describe('construction du serveur', () => {
    const fichiers = fichiersTs((0, path_1.join)(__dirname));
    it('le recensement trouve les sources du serveur', () => {
        expect(fichiers.length).toBeGreaterThan(100);
    });
    it('aucun fichier de src/ n’importe statiquement un module de client/', () => {
        const fautifs = fichiers.filter((f) => /(?:from|import)\s+['"](?:\.\.\/)+client\//.test((0, fs_1.readFileSync)(f, 'utf8')));
        expect(fautifs).toEqual([]);
    });
});
//# sourceMappingURL=construction-serveur.spec.js.map