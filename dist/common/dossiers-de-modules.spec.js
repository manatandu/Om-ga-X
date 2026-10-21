"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
describe('dossiers de src/modules', () => {
    const racine = (0, path_1.join)(__dirname, '..', 'modules');
    const dossiers = (0, fs_1.readdirSync)(racine).filter((n) => (0, fs_1.statSync)((0, path_1.join)(racine, n)).isDirectory());
    it('le relevé trouve encore des modules', () => {
        expect(dossiers.length).toBeGreaterThan(30);
    });
    it('chaque dossier de premier niveau porte un *.module.ts', () => {
        const sansModule = dossiers.filter((d) => !(0, fs_1.readdirSync)((0, path_1.join)(racine, d)).some((f) => f.endsWith('.module.ts')));
        expect(sansModule).toEqual([]);
    });
});
//# sourceMappingURL=dossiers-de-modules.spec.js.map