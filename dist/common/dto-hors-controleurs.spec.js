"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
function fichiers(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((n) => {
        const p = (0, path_1.join)(dossier, n);
        return (0, fs_1.statSync)(p).isDirectory() ? fichiers(p) : [p];
    });
}
describe('DTO hors des contrôleurs', () => {
    const controleurs = fichiers((0, path_1.join)(__dirname, '..', 'modules')).filter((f) => f.endsWith('.controller.ts'));
    it('le relevé trouve encore des contrôleurs', () => {
        expect(controleurs.length).toBeGreaterThan(50);
    });
    it('aucun contrôleur ne déclare de classe *Dto ni n’importe class-validator', () => {
        const fautifs = controleurs.filter((f) => {
            const s = (0, fs_1.readFileSync)(f, 'utf8');
            return /^export class \w+Dto\b/m.test(s) || /from 'class-validator'/.test(s);
        });
        expect(fautifs).toEqual([]);
    });
});
//# sourceMappingURL=dto-hors-controleurs.spec.js.map