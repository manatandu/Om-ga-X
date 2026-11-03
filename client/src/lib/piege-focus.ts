/**
 * PIÈGE DE FOCUS D'UNE MODALE (lot 3 du design, 2026-11-03).
 *
 * Sans lui, Tab sortait de la modale vers la fenêtre qu'elle recouvre : le
 * clavier agissait sur ce que l'écran cachait. Le calcul du prochain focus est
 * isolé ici, sans DOM, pour se tester ; `PortailModale` l'applique.
 */

/** Ce qui peut recevoir le focus à la touche Tab. */
export const SELECTEUR_FOCALISABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'summary',
].join(',');

/**
 * Rang à focaliser après Tab (ou Maj+Tab) parmi `nombre` éléments, `rang`
 * étant celui qui a le focus (`-1` quand il est hors de la liste).
 * Rend `null` quand le navigateur peut suivre son ordre naturel, c'est-à-dire
 * tant que l'on reste à l'intérieur ; ne rend un rang que pour BOUCLER, ou
 * pour faire rentrer un focus sorti. Sans élément focalisable, rien à faire :
 * la modale elle-même prend le focus (`-2`).
 */
export function rangApresTab(nombre: number, rang: number, retour: boolean): number | null {
  if (nombre === 0) return -2;
  if (rang === -1) return retour ? nombre - 1 : 0;
  if (!retour && rang === nombre - 1) return 0;
  if (retour && rang === 0) return nombre - 1;
  return null;
}
