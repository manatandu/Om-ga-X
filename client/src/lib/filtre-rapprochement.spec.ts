// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { filtrerPointees, mentionFiltreRapprochement } from './filtre-rapprochement';

/** Ligne gl-saisie, fonction 58 · les lignes rapprochées ou non. */
describe('filtre du rapprochement', () => {
  const lignes = [
    { id: 'a', pointee: true },
    { id: 'b', pointee: false },
    { id: 'c', pointee: false },
  ];

  it('retient les lignes pointées, ou les autres, ou toutes', () => {
    expect(filtrerPointees(lignes, 'TOUTES').map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(filtrerPointees(lignes, 'RAPPROCHEES').map((l) => l.id)).toEqual(['a']);
    expect(filtrerPointees(lignes, 'NON_RAPPROCHEES').map((l) => l.id)).toEqual(['b', 'c']);
  });

  it('dit ce qui est caché, et que les soldes portent tout le compte', () => {
    expect(mentionFiltreRapprochement('TOUTES', 0, false)).toBeNull();
    expect(mentionFiltreRapprochement('RAPPROCHEES', 2, false)).toBe('2 lignes non rapprochées cachées · les soldes portent tout le compte.');
    expect(mentionFiltreRapprochement('NON_RAPPROCHEES', 1, true)).toBe(
      '1 ligne rapprochée cachée parmi les lignes servies · les soldes portent tout le compte.',
    );
    expect(mentionFiltreRapprochement('NON_RAPPROCHEES', 0, true)).toBe('Filtre appliqué aux seules lignes servies.');
  });
});
