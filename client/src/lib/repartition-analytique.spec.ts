import { lirePourcentage, totalEnPointsDeBase } from './repartition-analytique';

describe('les pourcentages de la répartition analytique', () => {
  it('lit la virgule et le point, deux décimales au plus, et refuse le reste au lieu de l’arrondir', () => {
    expect(lirePourcentage('60')).toBe(60);
    expect(lirePourcentage('33,33')).toBe(33.33);
    expect(lirePourcentage(' 33.34 ')).toBe(33.34);
    expect(lirePourcentage('33,333')).toBeNull();
    expect(lirePourcentage('0')).toBeNull();
    expect(lirePourcentage('100,01')).toBeNull();
    expect(lirePourcentage('abc')).toBeNull();
  });

  it('additionne en points de base · un tiers chacun fait exactement 100 %', () => {
    expect(totalEnPointsDeBase(['33,33', '33,33', '33,34'])).toBe(10_000);
    expect(totalEnPointsDeBase(['60', '39,99'])).toBe(9_999);
    expect(totalEnPointsDeBase(['60', 'x'])).toBeNull();
    expect(totalEnPointsDeBase([])).toBe(0);
  });
});
