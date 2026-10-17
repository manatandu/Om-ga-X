"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const decimal_exact_1 = require("./decimal-exact");
describe('La valeur décimale exacte d’un nombre JavaScript', () => {
    it('relit un montant saisi au centime tel qu’il a été saisi', () => {
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.depuisNombre)(51_905.39))).toBe('51905.39');
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.depuisNombre)(0.1))).toBe('0.1');
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.depuisNombre)(-537_972.32))).toBe('-537972.32');
    });
    it('lit les écritures à exposant de Number::toString', () => {
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.depuisNombre)(1e21))).toBe('1000000000000000000000');
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.depuisNombre)(1.5e-7))).toBe('0.00000015');
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.depuisNombre)(-2.5e-8))).toBe('-0.000000025');
    });
    it('le zéro négatif est le zéro', () => {
        expect((0, decimal_exact_1.depuisNombre)(-0)).toEqual(decimal_exact_1.ZERO);
    });
    it('refuse une valeur non finie et un montant non chiffré, jamais un zéro', () => {
        expect(() => (0, decimal_exact_1.depuisNombre)(Number.NaN)).toThrow(RangeError);
        expect(() => (0, decimal_exact_1.depuisNombre)(Number.POSITIVE_INFINITY)).toThrow(RangeError);
        expect(() => (0, decimal_exact_1.exact)(null)).toThrow('Montant non chiffré');
    });
});
describe('Les opérations sont exactes là où le flottant ne l’est pas', () => {
    const cinqLignes = [51_905.39, 53_651.71, 168_138.49, 68_332.09, 537_972.32];
    it('témoin · la somme flottante des cinq lignes tombe sous 880 000', () => {
        expect(cinqLignes.reduce((a, b) => a + b, 0)).toBeLessThan(880_000);
    });
    it('la somme exacte des cinq lignes vaut 880 000', () => {
        expect((0, decimal_exact_1.versNombre)((0, decimal_exact_1.somme)(cinqLignes.map(decimal_exact_1.depuisNombre)))).toBe(880_000);
    });
    it('0,1 + 0,2 vaut 0,3, et 0,3 − 0,1 vaut 0,2', () => {
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.plus)((0, decimal_exact_1.depuisNombre)(0.1), (0, decimal_exact_1.depuisNombre)(0.2)))).toBe('0.3');
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.moins)((0, decimal_exact_1.depuisNombre)(0.3), (0, decimal_exact_1.depuisNombre)(0.1)))).toBe('0.2');
    });
    it('un pourcentage garde toutes ses décimales, sans arrondi', () => {
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.pourCent)((0, decimal_exact_1.depuisNombre)(100_000.1), (0, decimal_exact_1.depuisNombre)(5)))).toBe('5000.005');
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.fois)((0, decimal_exact_1.depuisNombre)(1.7), (0, decimal_exact_1.depuisNombre)(1.5)))).toBe('2.55');
        expect((0, decimal_exact_1.versChaine)((0, decimal_exact_1.foisEntier)((0, decimal_exact_1.depuisNombre)(835_999.9997), 12))).toBe('10031999.9964');
    });
    it('compare et prend le plus grand sans passer par le flottant', () => {
        expect((0, decimal_exact_1.comparer)((0, decimal_exact_1.depuisNombre)(0.1 + 0.2), (0, decimal_exact_1.depuisNombre)(0.3))).toBe(1);
        expect((0, decimal_exact_1.comparer)((0, decimal_exact_1.depuisNombre)(0.3), (0, decimal_exact_1.depuisNombre)(0.3))).toBe(0);
        expect((0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, (0, decimal_exact_1.depuisNombre)(-0.01))).toEqual(decimal_exact_1.ZERO);
    });
});
describe('Le plancher au multiple · l’arrondi au millier inférieur de l’art. 118', () => {
    it('un millier exact reste ce millier', () => {
        expect((0, decimal_exact_1.plancherAuMultiple)((0, decimal_exact_1.depuisNombre)(10_032_000), 1_000)).toBe(10_032_000);
    });
    it('999,9964 FC sous le millier restent sous le millier · aucun arrondi au centime d’abord', () => {
        expect((0, decimal_exact_1.plancherAuMultiple)((0, decimal_exact_1.depuisNombre)(10_031_999.9964), 1_000)).toBe(10_031_000);
    });
    it('descend vers moins l’infini, comme Math.floor', () => {
        expect((0, decimal_exact_1.plancherAuMultiple)((0, decimal_exact_1.depuisNombre)(-0.5), 1_000)).toBe(-1_000);
        expect((0, decimal_exact_1.plancherAuMultiple)((0, decimal_exact_1.depuisNombre)(-1_000), 1_000)).toBe(-1_000);
    });
});
describe('Les centimes, le demi-centime loin de zéro, comme la colonne Decimal(18,2)', () => {
    it('range -0,005 à -0,01 et 0,005 à 0,01, comme PostgreSQL', () => {
        expect((0, decimal_exact_1.centimesLoinDeZero)((0, decimal_exact_1.depuisNombre)(0.005))).toBe(1n);
        expect((0, decimal_exact_1.centimesLoinDeZero)((0, decimal_exact_1.depuisNombre)(-0.005))).toBe(-1n);
        expect((0, decimal_exact_1.centimesLoinDeZero)((0, decimal_exact_1.depuisNombre)(-0.0049999))).toBe(0n);
        expect((0, decimal_exact_1.centimesLoinDeZero)((0, decimal_exact_1.depuisNombre)(503_900.095))).toBe(50390010n);
        expect((0, decimal_exact_1.centimesLoinDeZero)((0, decimal_exact_1.depuisNombre)(730_100))).toBe(73010000n);
    });
    it('juge zéro un reste de bruit flottant', () => {
        expect((0, decimal_exact_1.centimesLoinDeZero)((0, decimal_exact_1.depuisNombre)(-1.1641532182693481e-10))).toBe(0n);
    });
});
//# sourceMappingURL=decimal-exact.spec.js.map