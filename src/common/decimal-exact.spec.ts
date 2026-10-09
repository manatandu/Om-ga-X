import {
  ZERO,
  centimesDemiHaut,
  comparer,
  depuisNombre,
  exact,
  fois,
  foisEntier,
  maximum,
  moins,
  plancherAuMultiple,
  plus,
  pourCent,
  somme,
  versChaine,
  versNombre,
} from './decimal-exact';

/**
 * L'ARITHMÉTIQUE EXACTE DES SEUILS ET DES PALIERS (second tour de relecture du
 * paquet 1, ligne C, BLOQUANT du millier). Ce qu'elle doit rendre est ce que
 * le flottant ne rend pas · chaque test pose le cas où le flottant se trompe.
 */
describe('La valeur décimale exacte d’un nombre JavaScript', () => {
  it('relit un montant saisi au centime tel qu’il a été saisi', () => {
    expect(versChaine(depuisNombre(51_905.39))).toBe('51905.39');
    expect(versChaine(depuisNombre(0.1))).toBe('0.1');
    expect(versChaine(depuisNombre(-537_972.32))).toBe('-537972.32');
  });

  it('lit les écritures à exposant de Number::toString', () => {
    expect(versChaine(depuisNombre(1e21))).toBe('1000000000000000000000');
    expect(versChaine(depuisNombre(1.5e-7))).toBe('0.00000015');
    expect(versChaine(depuisNombre(-2.5e-8))).toBe('-0.000000025');
  });

  it('le zéro négatif est le zéro', () => {
    expect(depuisNombre(-0)).toEqual(ZERO);
  });

  it('refuse une valeur non finie et un montant non chiffré, jamais un zéro', () => {
    expect(() => depuisNombre(Number.NaN)).toThrow(RangeError);
    expect(() => depuisNombre(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => exact(null as unknown as number)).toThrow('Montant non chiffré');
  });
});

describe('Les opérations sont exactes là où le flottant ne l’est pas', () => {
  const cinqLignes = [51_905.39, 53_651.71, 168_138.49, 68_332.09, 537_972.32];

  it('témoin · la somme flottante des cinq lignes tombe sous 880 000', () => {
    expect(cinqLignes.reduce((a, b) => a + b, 0)).toBeLessThan(880_000);
  });

  it('la somme exacte des cinq lignes vaut 880 000', () => {
    expect(versNombre(somme(cinqLignes.map(depuisNombre)))).toBe(880_000);
  });

  it('0,1 + 0,2 vaut 0,3, et 0,3 − 0,1 vaut 0,2', () => {
    expect(versChaine(plus(depuisNombre(0.1), depuisNombre(0.2)))).toBe('0.3');
    expect(versChaine(moins(depuisNombre(0.3), depuisNombre(0.1)))).toBe('0.2');
  });

  it('un pourcentage garde toutes ses décimales, sans arrondi', () => {
    // 5 % d'une base qui finit en dixième · un demi-centime, gardé tel quel.
    expect(versChaine(pourCent(depuisNombre(100_000.1), depuisNombre(5)))).toBe('5000.005');
    expect(versChaine(fois(depuisNombre(1.7), depuisNombre(1.5)))).toBe('2.55');
    expect(versChaine(foisEntier(depuisNombre(835_999.9997), 12))).toBe('10031999.9964');
  });

  it('compare et prend le plus grand sans passer par le flottant', () => {
    expect(comparer(depuisNombre(0.1 + 0.2), depuisNombre(0.3))).toBe(1);
    expect(comparer(depuisNombre(0.3), depuisNombre(0.3))).toBe(0);
    expect(maximum(ZERO, depuisNombre(-0.01))).toEqual(ZERO);
  });
});

describe('Le plancher au multiple · l’arrondi au millier inférieur de l’art. 118', () => {
  it('un millier exact reste ce millier', () => {
    expect(plancherAuMultiple(depuisNombre(10_032_000), 1_000)).toBe(10_032_000);
  });

  it('999,9964 FC sous le millier restent sous le millier · aucun arrondi au centime d’abord', () => {
    // Arrondi d'abord au centime, 10 031 999,9964 rendrait 10 032 000,00 et
    // ferait monter le revenu d'un millier entier.
    expect(plancherAuMultiple(depuisNombre(10_031_999.9964), 1_000)).toBe(10_031_000);
  });

  it('descend vers moins l’infini, comme Math.floor', () => {
    expect(plancherAuMultiple(depuisNombre(-0.5), 1_000)).toBe(-1_000);
    expect(plancherAuMultiple(depuisNombre(-1_000), 1_000)).toBe(-1_000);
  });
});

describe('Les centimes, le demi-centime vers le haut, comme Math.round de la passation', () => {
  it('rend les mêmes centimes que Math.round(x × 100) sur la valeur exacte', () => {
    expect(centimesDemiHaut(depuisNombre(0.005))).toBe(1n);
    expect(centimesDemiHaut(depuisNombre(-0.005))).toBe(0n);
    expect(centimesDemiHaut(depuisNombre(-0.0051))).toBe(-1n);
    expect(centimesDemiHaut(depuisNombre(730_100))).toBe(73_010_000n);
  });

  it('juge zéro un écart de bruit flottant, que Math.round(x × 100) juge aussi zéro', () => {
    expect(centimesDemiHaut(depuisNombre(-1.1641532182693481e-10))).toBe(0n);
  });
});
