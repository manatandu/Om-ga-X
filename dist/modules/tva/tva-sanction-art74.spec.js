"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
describe('art. 74, alinéa 2 · la sanction est celle de l’alinéa 1er', () => {
    const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'taux-tva.service.ts'), 'utf8');
    it('la liste des manques rend la sanction de l’alinéa 1er', () => {
        expect(source).toContain('« égale au montant des droits indûment déduits »');
        expect(source).toContain("celle de l'art. 74, alinéa 2 (document servi DEUX FOIS à la déduction),\n *    qui n'est PAS du triple");
    });
});
//# sourceMappingURL=tva-sanction-art74.spec.js.map