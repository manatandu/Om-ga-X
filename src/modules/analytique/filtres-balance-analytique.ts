/**
 * LIGNE ANALYTIQUE, FONCTION N° 53 · LES FILTRES DE LA BALANCE ANALYTIQUE.
 *
 * Sage (manuel 2, ligne 48) imprime la balance analytique sur les sections
 * « toutes, mouvementées, non soldées ». Aucun texte ne régit ce choix · la
 * comptabilité analytique est « laissée à l'initiative des entités » (SYCEBNL,
 * Partie 2 ch. 3, classe 9, sous-section 2 ; AUDCIF, Titre VII ch. 3, classe 9,
 * sous-section 2). Les trois lectures sont des conventions d'OmegaX, dites
 * dans la bulle.
 *
 * LE FILTRE MASQUE, IL NE RECALCULE RIEN · les totaux restent ceux de TOUTES
 * les sections Détail (`totalDesFeuilles`), et le nombre de sections masquées
 * est rendu · sans quoi une balance filtrée « non soldées » afficherait des
 * totaux de mouvements qui ne seraient plus ceux de l'axe, sans le dire.
 *
 * UNE RUBRIQUE SE JUGE SUR SES PROPRES VALEURS · elles agrègent ses feuilles
 * (`valeurDeLaLigne`), si bien qu'une rubrique reste visible dès qu'une de ses
 * feuilles l'est, et disparaît avec elles.
 *
 * LE ZÉRO SE JUGE AU CENTIME · un solde de 0,004 né d'additions flottantes
 * n'est pas un solde (même règle que `personnel/au-centime.ts`).
 */

export const FILTRES_BALANCE_ANALYTIQUE = ['TOUTES', 'MOUVEMENTEES', 'NON_SOLDEES'] as const;
export type FiltreBalanceAnalytique = (typeof FILTRES_BALANCE_ANALYTIQUE)[number];

/** Le filtre lu dans la requête · absent ou vide, toutes les sections ; inconnu, `null` (refus nommé par l'appelant). */
export function lireFiltreBalance(texte: string | undefined | null): FiltreBalanceAnalytique | null {
  const t = (texte ?? '').trim().toUpperCase();
  if (t === '') return 'TOUTES';
  return (FILTRES_BALANCE_ANALYTIQUE as readonly string[]).includes(t) ? (t as FiltreBalanceAnalytique) : null;
}

const nonNulAuCentime = (x: number) => Math.round(x * 100) !== 0;

/** La section passe-t-elle le filtre ? */
export function passeLeFiltre(ligne: { debit: number; credit: number; solde: number }, filtre: FiltreBalanceAnalytique): boolean {
  if (filtre === 'MOUVEMENTEES') return nonNulAuCentime(ligne.debit) || nonNulAuCentime(ligne.credit);
  if (filtre === 'NON_SOLDEES') return nonNulAuCentime(ligne.solde);
  return true;
}

/** Les lignes gardées, et le nombre de lignes masquées. */
export function filtrerBalance<L extends { debit: number; credit: number; solde: number }>(
  lignes: readonly L[],
  filtre: FiltreBalanceAnalytique,
): { lignes: L[]; masquees: number } {
  const gardees = lignes.filter((l) => passeLeFiltre(l, filtre));
  return { lignes: gardees, masquees: lignes.length - gardees.length };
}
