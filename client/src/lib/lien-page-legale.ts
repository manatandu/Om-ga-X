/**
 * LES LIENS ENTRE PAGES LÉGALES (ligne pages-legales, second tour de
 * relecture, M1). Fichier sans JSX · le spec qui l'éprouve tourne aussi sous
 * le jest de la racine, qui ne lit pas le TSX.
 */

export type CheminPagePublique = '/questions-frequentes' | '/contrat-de-licence' | '/confidentialite';

/**
 * OÙ MÈNE UN LIEN ENTRE PAGES LÉGALES · la page publique vers la page
 * publique ; dans une fenêtre, vers la FENÊTRE de l'autre page (`/aide/…`),
 * par la navigation de l'espace de travail. Un lien vers la route publique,
 * suivi depuis une fenêtre, sortait de la zone protégée · l'espace de travail
 * se démontait, et avec lui tout travail non enregistré des autres fenêtres.
 */
export function cibleDuLien(chemin: CheminPagePublique, enFenetre: boolean): { href: string; routeInterne: string | null } {
  return enFenetre ? { href: `#/aide${chemin}`, routeInterne: `/aide${chemin}` } : { href: `#${chemin}`, routeInterne: null };
}
