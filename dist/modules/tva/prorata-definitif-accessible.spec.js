"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'taux-tva.service.ts'), 'utf8');
const controleur = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'taux-tva.controller.ts'), 'utf8');
const page = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', '..', '..', 'client', 'src', 'pages', 'DeclarationTvaPage.tsx'), 'utf8');
describe('prorata définitif · joignable de bout en bout', () => {
    it('le calcul existe toujours', () => {
        expect(service).toContain('async prorataDefinitif(');
    });
    it('une route le sert', () => {
        expect(controleur).toContain("@Get('prorata-definitif')");
        expect(controleur).toContain('this.tauxTvaService.prorataDefinitif(');
    });
    it('la route refuse une année absurde plutôt que de calculer sur NaN', () => {
        expect(controleur).toContain('Number.isInteger(n)');
    });
    it('un écran l’appelle et rend le SENS de la régularisation', () => {
        expect(page).toContain('/taux-tva/prorata-definitif?annee=');
        expect(page).toContain('DEDUCTION_COMPLEMENTAIRE');
        expect(page).toContain('Reversement');
        expect(page).toContain('definitif.echeance');
    });
    it('l’écran rappelle la règle des deux proratas, pas seulement le chiffre', () => {
        expect(page).toContain('article 45');
        expect(page).toContain('31 mars');
    });
});
//# sourceMappingURL=prorata-definitif-accessible.spec.js.map