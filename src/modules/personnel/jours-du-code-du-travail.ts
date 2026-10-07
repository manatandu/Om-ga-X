/**
 * LES JOURS AU SENS DU CODE DU TRAVAIL · ouvrables, fériés, et le samedi qui
 * porte le congé d'un férié tombé un dimanche (décision T9 du 2026-10-07,
 * `docs/decisions-par-la-loi-paie-2026-10-07.md`).
 *
 * Code du travail, art. 7, point 9 · « Jour ouvrable : chaque jour de la
 * semaine à l'exception du jour de repos hebdomadaire et des jours fériés
 * légaux. » Le repos « a lieu le dimanche » (art. 121, al. 2). Les jours
 * fériés légaux sont ceux de l'ordonnance n° 23-042 du 30 mars 2023, art. 1er,
 * et son art. 2 ajoute · « Dans le cas où l'un des jours fériés légaux visés à
 * l'article 1er coïncide avec un dimanche, le congé relatif à ce jour est pris
 * le jour précédent. »
 *
 * LE SAMEDI QUI PORTE CE CONGÉ N'EST PAS UN JOUR OUVRABLE. La lettre de
 * l'art. 2 déplace « le congé », pas « le jour férié », et ne dit pas non plus
 * que le jour rendu chômé reste ouvrable · le compter ouvrable ôterait à
 * l'art. 2 tout effet dans les décomptes du Code (préavis, congé), le férié
 * tombé un dimanche disparaissant. S'agissant d'un minimum protecteur
 * (art. 64, al. 1 ; art. 258), la règle de protection du dépôt tranche (une
 * règle de protection ne se tranche pas contre celui qu'elle protège). Le jour
 * reste RÉMUNÉRÉ comme le férié (art. 93).
 *
 * CE FICHIER NE SERT PAS LE JOUR OUVRABLE FISCAL · `retenues/jour-ouvrable.ts`
 * répond à une autre question (un guichet de l'Administration, samedi exclu
 * par le décret n° 24/09), et son art. 2 n'y est pas calculé. Seule la LISTE
 * des dix jours fériés en est reprise, qui vaut pour les deux.
 */
import { jourFerie } from '../retenues/jour-ouvrable';

export type NatureDuJour =
  /** Jour ouvrable de l'art. 7, point 9 · rémunéré. */
  | 'OUVRABLE'
  /** Repos hebdomadaire (art. 121, al. 2) · ni ouvrable ni rémunéré à la journée. */
  | 'DIMANCHE'
  /** Jour férié légal de l'ordonnance n° 23-042, art. 1er · non ouvrable, rémunéré (art. 93). */
  | 'FERIE'
  /** Samedi portant le congé d'un férié tombé un dimanche (art. 2) · non ouvrable, rémunéré. */
  | 'CONGE_DU_FERIE_DU_DIMANCHE';

const lendemain = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));

/**
 * Le férié dont ce samedi porte le congé, ou `null`. Un samedi déjà férié
 * lui-même (le 16 janvier 2027, veille du 17, dimanche) reste un férié ·
 * l'ordonnance ne dit pas où se prend alors le congé du dimanche, et rien
 * n'est déplacé plus loin.
 */
export function congeDuFerieDuDimanche(d: Date): string | null {
  if (d.getUTCDay() !== 6) return null;
  return jourFerie(lendemain(d));
}

export function natureDuJour(d: Date): NatureDuJour {
  if (d.getUTCDay() === 0) return 'DIMANCHE';
  if (jourFerie(d) !== null) return 'FERIE';
  if (congeDuFerieDuDimanche(d) !== null) return 'CONGE_DU_FERIE_DU_DIMANCHE';
  return 'OUVRABLE';
}

export const estJourOuvrableDuCode = (d: Date): boolean => natureDuJour(d) === 'OUVRABLE';

/**
 * Un jour du lundi au samedi · c'est la journée qu'une rémunération
 * journalière paie, fériés compris (art. 93, « elle est également due [...]
 * pour les jours fériés légaux »), et les vingt-six jours du mois du décret
 * n° 25/22, art. 7, sont ces jours-là.
 */
export const estJourRemunere = (d: Date): boolean => natureDuJour(d) !== 'DIMANCHE';
