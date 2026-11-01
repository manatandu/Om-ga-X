import { referencePaie } from './comptabilisation-paie.service';

/**
 * Relevé de la ligne des corrections de la paie · une passation qui ne fait
 * que reprendre un bulletin en négatif portait la référence « Bulletins n° »,
 * vide.
 */
describe('la référence de la pièce de paie', () => {
  it('nomme les bulletins passés', () => {
    expect(referencePaie([{ numero: 3 }, { numero: 4 }], [])).toBe('Bulletins n° 3, 4');
  });

  it('nomme les bulletins repris en négatif, seuls ou avec d’autres', () => {
    expect(referencePaie([], [{ numero: 2 }])).toBe('repris en négatif n° 2');
    expect(referencePaie([{ numero: 5 }], [{ numero: 2 }])).toBe('Bulletins n° 5 · repris en négatif n° 2');
  });
});
