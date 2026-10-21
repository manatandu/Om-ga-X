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
describe('ReferentielsAutorises et ReferentielGuard · toujours ensemble', () => {
    const fichiers = controleurs((0, path_1.join)(__dirname, '../..'));
    const lus = fichiers.map((f) => {
        const source = (0, fs_1.readFileSync)(f, 'utf-8');
        return {
            fichier: (0, path_1.relative)((0, path_1.join)(__dirname, '../..'), f),
            decore: source.includes('@ReferentielsAutorises('),
            garde: /@UseGuards\([^)]*\bReferentielGuard\b/.test(source),
        };
    });
    it('le recensement trouve des contrôleurs cloisonnés · sinon rien n’est vérifié', () => {
        expect(lus.filter((c) => c.decore && c.garde).length).toBeGreaterThan(5);
    });
    it('aucun décorateur sans sa garde', () => {
        expect(lus.filter((c) => c.decore && !c.garde).map((c) => c.fichier)).toEqual([]);
    });
    it('aucune garde sans décorateur', () => {
        expect(lus.filter((c) => c.garde && !c.decore).map((c) => c.fichier)).toEqual([]);
    });
});
//# sourceMappingURL=referentiel-apparie.spec.js.map