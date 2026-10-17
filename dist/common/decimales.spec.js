"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const decimales_1 = require("./decimales");
describe('nombreDeDecimales', () => {
    it.each([
        [19.99, 2],
        [1.1, 1],
        [1234.1, 1],
        [0.07, 2],
        [1_000_000.01, 2],
        [1500, 0],
        [5e21, 0],
        [1.005, 3],
    ])('%p a %p décimale(s)', (x, n) => {
        expect((0, decimales_1.nombreDeDecimales)(x)).toBe(n);
    });
    it('un nombre très petit dépasse tout plafond', () => {
        expect((0, decimales_1.nombreDeDecimales)(1e-7)).toBeGreaterThan(2);
    });
});
//# sourceMappingURL=decimales.spec.js.map