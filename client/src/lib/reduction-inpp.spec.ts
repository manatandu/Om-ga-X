import { motifReductionInppIllisible } from './reduction-inpp';

describe("Réduction INPP saisie · une valeur illisible se dit, jamais lue comme « aucune » (mineur b)", () => {
  it('vide = aucune réduction, sans motif', () => {
    expect(motifReductionInppIllisible('')).toBeNull();
    expect(motifReductionInppIllisible('   ')).toBeNull();
  });

  it('un nombre de points lisible passe, virgule ou point', () => {
    expect(motifReductionInppIllisible('0,5')).toBeNull();
    expect(motifReductionInppIllisible('0.875')).toBeNull();
    expect(motifReductionInppIllisible(' 1 ')).toBeNull();
  });

  it('du texte, un pourcentage ou un signe est illisible et se dit', () => {
    expect(motifReductionInppIllisible('un demi')).toContain('illisible');
    expect(motifReductionInppIllisible('0,5 %')).toContain('illisible');
    expect(motifReductionInppIllisible('-0,5')).toContain('illisible');
    expect(motifReductionInppIllisible('0,5,1')).toContain('illisible');
  });

  it('zéro et plus de trois décimales se disent aussi', () => {
    expect(motifReductionInppIllisible('0')).toContain('nulle');
    expect(motifReductionInppIllisible('0,8755')).toContain('millième');
  });
});
