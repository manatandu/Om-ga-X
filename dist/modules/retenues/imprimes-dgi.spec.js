"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_retenues_1 = require("./correspondance-retenues");
describe('Codes d’imprimé DGI', () => {
    it('ne sont posés que là où l’imprimé a été lu', () => {
        const avecImprime = correspondance_retenues_1.NATURES_RETENUES.filter((n) => n.imprime).map((n) => n.cle);
        expect(avecImprime).toEqual(['irppSalaires']);
    });
    it('suivent la forme des codes DGI · majuscules et chiffres, rien d’autre', () => {
        for (const n of correspondance_retenues_1.NATURES_RETENUES) {
            if (!n.imprime)
                continue;
            expect(n.imprime).toMatch(/^[A-Z0-9]{4,12}$/);
        }
    });
});
//# sourceMappingURL=imprimes-dgi.spec.js.map