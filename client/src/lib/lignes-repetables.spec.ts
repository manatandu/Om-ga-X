import { lignesAvecAjouts } from './lignes-repetables';
import type { LigneNoteCalculee } from './types';

/**
 * LIGNES RÉPÉTABLES (notes 4, 13, 32 et 33 du SYSCOHADA ; décision par la loi
 * du 2026-10-04, point 2) · l'écran ajoute après la DERNIÈRE occurrence les
 * lignes vides demandées, au rang qui suit le plus grand rang servi, puis le
 * bouton · les lignes finales restent à leur place.
 */
const ligne = (cle: string | undefined, libelle: string, rang?: number, saisie?: (string | null)[]): LigneNoteCalculee =>
  ({ cle, libelle, rang, saisie, montantN: 0, estTotal: false }) as LigneNoteCalculee;

describe('lignes répétables à l’écran', () => {
  const lignes = [
    ligne('apporteurs', 'Apporteurs', 0, ['A', null]),
    ligne('apporteurs', 'Apporteurs', 2, ['B', null]),
    ligne(undefined, 'TOTAL'),
  ];

  it('sans ajout · les occurrences, le bouton, puis les lignes finales', () => {
    const r = lignesAvecAjouts(lignes, 2, {});
    expect(r.map((l) => ('ajouterApres' in l ? `+${l.ajouterApres}` : `${l.libelle}:${l.rang ?? '-'}`))).toEqual([
      'Apporteurs:0',
      'Apporteurs:2',
      '+apporteurs',
      'TOTAL:-',
    ]);
  });

  it('deux lignes ajoutées · rangs 3 et 4, vides, avant le bouton', () => {
    const r = lignesAvecAjouts(lignes, 2, { apporteurs: 2 });
    const ajoutees = r.filter((l): l is LigneNoteCalculee => !('ajouterApres' in l) && (l.rang ?? 0) > 2);
    expect(ajoutees.map((l) => [l.rang, l.saisie])).toEqual([
      [3, [null, null]],
      [4, [null, null]],
    ]);
    expect('ajouterApres' in r[4]).toBe(true);
  });

  it('une rubrique non répétable (sans rang) ne reçoit pas de bouton', () => {
    const r = lignesAvecAjouts([ligne('autre', 'Autre', undefined, [null])], 1, {});
    expect(r).toHaveLength(1);
  });
});
