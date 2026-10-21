/**
 * LA PRÉ-IMAGE QUI N'A PAS PU ÊTRE LUE SE DIT, ELLE NE SE RANGE PAS VIDE
 * (ligne k6-defauts, 2026-10-21 · relecture du test de charge, § 4.12).
 *
 * Le journal d'audit relit la ligne AVANT une modification ou une
 * suppression (`extension-audit.ts`). Quand cette lecture échoue hors d'une
 * transaction (pool saturé, clé composée illisible), l'opération part quand
 * même et le maillon se rangeait avec `avant: null` · la même valeur qu'une
 * ligne qui n'existait pas. Deux lecteurs du journal prenaient alors
 * l'absence pour « rien avant » · la clôture d'un exercice
 * (`fiche-immobilisation.service.ts`, qui cherche le maillon qui a fait
 * passer l'exercice à CLOTURE) et la suppression d'un lettrage
 * (`taux-tva.service.ts`, qui cherche le compte du groupe supprimé pour dire
 * une reconstitution incertaine). Un maillon dont la pré-image n'a pas été
 * lue porte désormais ce marqueur, et chaque lecteur le traite comme un
 * INCONNU · le doute fige la fiche, le doute rend la reconstitution
 * incertaine. Jamais comme un vide.
 */
export const PRE_IMAGE_ILLISIBLE = Object.freeze({ preImageIllisible: true as const });

/** Vrai quand le maillon dit que sa pré-image n'a pas pu être lue. */
export function preImageIllisible(avant: unknown): boolean {
  return !!avant && typeof avant === 'object' && (avant as { preImageIllisible?: unknown }).preImageIllisible === true;
}
