"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lecture_fichier_1 = require("./lecture-fichier");
describe('lireMontant', () => {
    it.each([
        ['1234.56', 1234.56],
        ['1 234,56', 1234.56],
        ['1 234,56', 1234.56],
        ['1 234,56', 1234.56],
        ['1.234,56', 1234.56],
        ['1,234.56', 1234.56],
        ['(1234.56)', -1234.56],
        ['-500', -500],
        ['', 0],
        ['-', 0],
        ['12 000 CDF', 12000],
    ])('lit « %s » comme %s', (entree, attendu) => {
        expect((0, lecture_fichier_1.lireMontant)(entree)).toBeCloseTo(attendu, 2);
    });
    it('renvoie null sur ce qui n’est pas un montant', () => {
        expect((0, lecture_fichier_1.lireMontant)('n/a')).toBeNull();
        expect((0, lecture_fichier_1.lireMontant)('douze')).toBeNull();
    });
});
describe('lireDate', () => {
    it.each([
        ['2026-03-15', '2026-03-15'],
        ['15/03/2026', '2026-03-15'],
        ['15-03-2026', '2026-03-15'],
        ['5/3/26', '2026-03-05'],
    ])('lit « %s » comme %s', (entree, attendu) => {
        expect((0, lecture_fichier_1.lireDate)(entree)?.toISOString().slice(0, 10)).toBe(attendu);
    });
    it('renvoie null sur une date illisible', () => {
        expect((0, lecture_fichier_1.lireDate)('')).toBeNull();
        expect((0, lecture_fichier_1.lireDate)('le 3 mars')).toBeNull();
    });
});
//# sourceMappingURL=lecture-fichier.spec.js.map