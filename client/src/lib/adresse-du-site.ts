/**
 * LE SITE ET LE LOGICIEL NE PARTAGENT PAS LEUR ADRESSE (décision de Manasse
 * du 2026-10-24 · « Pour le logiciel, laisse omegax.web.app », lu comme
 * l'adresse Firebase du logiciel, oomega.web.app).
 *
 * `omegax.vmgconsulting.net` est rattachée au MÊME site Firebase que le
 * logiciel (`client/firebase.json`, cible `oomega`), qui renvoie toute
 * adresse vers `index.html` · sa racine ouvrait donc l'écran de connexion,
 * alors que cette adresse devait porter le site d'OmegaX. Firebase Hosting
 * ne sait pas aiguiller selon le nom de domaine ; l'aiguillage se fait donc
 * ici, avant tout rendu :
 *  · la racine de l'adresse du site ouvre la page publique (`/vitrine/`) ;
 *  · une adresse du logiciel (`/#/connexion`, `/#/essai`, une page légale)
 *    part vers le logiciel, à son adresse, chemin et ancre gardés · la
 *    session ne naît ainsi jamais sous le nom du site, et la page publique
 *    garde ses liens relatifs (`vitrine-publique.spec.ts` y refuse toute
 *    adresse absolue).
 * Toute autre adresse (oomega.web.app, aperçus Firebase, poste sur site,
 * développement) n'est pas touchée.
 */

/** L'adresse du site d'OmegaX, qui ne sert jamais le logiciel. */
export const ADRESSE_DU_SITE = 'omegax.vmgconsulting.net';

/** L'adresse du logiciel, celle que cite le contrat de licence. */
export const ADRESSE_DU_LOGICIEL = 'https://oomega.web.app';

/**
 * Où envoyer la fenêtre, ou `null` pour la laisser. Le nom d'hôte se compare
 * sans la casse (un navigateur le rend en minuscules, un lien saisi non).
 */
export function redirectionDuSite(lieu: { hostname: string; pathname: string; search: string; hash: string }): string | null {
  if (lieu.hostname.toLowerCase() !== ADRESSE_DU_SITE) return null;
  // Une ancre vide (« # » seul) ne désigne aucune page du logiciel.
  const ancre = lieu.hash === '#' ? '' : lieu.hash;
  if (ancre === '') return '/vitrine/';
  return `${ADRESSE_DU_LOGICIEL}${lieu.pathname}${lieu.search}${ancre}`;
}
