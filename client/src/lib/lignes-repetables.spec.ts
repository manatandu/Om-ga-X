import { lignesAvecAjouts, rangSuivant } from './lignes-repetables';
import type { LigneNoteCalculee } from './types';

/**
 * LIGNES RÉPÉTABLES (notes 4, 13, 32 et 33 du SYSCOHADA ; décision par la loi
 * du 2026-10-04, point 2) · l'écran montre après la DERNIÈRE occurrence les
 * lignes vides demandées, mémorisées PAR RANG, puis le bouton · les lignes
 * finales restent à leur place, et une ligne demandée devenue réelle n'est
 * jamais montrée deux fois.
 */
const ligne = (cle: string | undefined, libelle: string, rang?: number, saisie?: (string | null)[]): LigneNoteCalculee =>
  ({ cle, libelle, rang, saisie, montantN: 0, estTotal: false }) as LigneNoteCalculee;
const etiquette = (l: LigneNoteCalculee | { ajouterApres: string }) =>
  'ajouterApres' in l ? `+${l.ajouterApres}` : `${l.libelle}:${l.rang ?? '-'}:${l.saisie?.[0] ?? ''}`;

describe('lignes répétables à l’écran', () => {
  const lignes = [
    ligne('apporteurs', 'Apporteurs', 0, ['A', null]),
    ligne('apporteurs', 'Apporteurs', 2, ['B', null]),
    ligne(undefined, 'TOTAL'),
  ];

  it('sans demande · les occurrences, le bouton, puis les lignes finales', () => {
    expect(lignesAvecAjouts(lignes, 2, {}).map(etiquette)).toEqual(['Apporteurs:0:A', 'Apporteurs:2:B', '+apporteurs', 'TOTAL:-:']);
  });

  it('le rang suivant part du plus grand rang SERVI OU DEMANDÉ · jamais celui d’une ligne existante', () => {
    expect(rangSuivant(lignes, 'apporteurs', {})).toBe(3);
    expect(rangSuivant(lignes, 'apporteurs', { apporteurs: [3] })).toBe(4);
    expect(rangSuivant([], 'filiales', {})).toBe(0);
  });

  it('deux lignes demandées · vides, avant le bouton ; devenue réelle, une ligne demandée n’est plus montrée vide', () => {
    expect(lignesAvecAjouts(lignes, 2, { apporteurs: [3, 4] }).map(etiquette)).toEqual([
      'Apporteurs:0:A',
      'Apporteurs:2:B',
      'Apporteurs:3:',
      'Apporteurs:4:',
      '+apporteurs',
      'TOTAL:-:',
    ]);
    // Le serveur relu rend le rang 3 comme ligne réelle · il ne revient pas vide en double.
    const relues = [...lignes.slice(0, 2), ligne('apporteurs', 'Apporteurs', 3, ['C', null]), lignes[2]];
    expect(lignesAvecAjouts(relues, 2, { apporteurs: [3, 4] }).map(etiquette)).toEqual([
      'Apporteurs:0:A',
      'Apporteurs:2:B',
      'Apporteurs:3:C',
      'Apporteurs:4:',
      '+apporteurs',
      'TOTAL:-:',
    ]);
  });

  it('une rubrique non répétable (sans rang) ne reçoit pas de bouton', () => {
    expect(lignesAvecAjouts([ligne('autre', 'Autre', undefined, [null])], 1, {})).toHaveLength(1);
  });
});
