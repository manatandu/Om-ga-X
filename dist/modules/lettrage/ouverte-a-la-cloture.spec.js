"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ouverte_a_la_cloture_1 = require("./ouverte-a-la-cloture");
describe('Ligne ouverte à la clôture', () => {
    it('garde la ligne sans lettre, et celle que soldait un règlement postérieur à la clôture', () => {
        const fin = new Date('2026-12-31');
        expect((0, ouverte_a_la_cloture_1.ouverteALaCloture)(fin)).toEqual({
            OR: [{ lettre: null }, { lettrage: { lignes: { some: { ecriture: { date: { gt: fin } } } } } }],
        });
    });
});
//# sourceMappingURL=ouverte-a-la-cloture.spec.js.map