/**
 * LA QUALITÉ DU TIERS À L'ÉCRAN (ligne sage-l2, fonction 24) · le miroir de
 * `src/modules/tiers/qualite-tiers.ts`, tenu par son spec, qui relit la liste
 * et la longueur du serveur · un libellé PROPOSÉ, jamais une règle.
 */
export const LONGUEUR_QUALITE = 35;

export const QUALITES_PROPOSEES: readonly string[] = [
  'Société',
  'Entreprise individuelle',
  'Entreprenant',
  'Indépendant',
  'Association',
  'Organisation non gouvernementale',
  'Établissement public',
  'Administration',
  'Particulier',
];

/** La qualité à envoyer · rangée comme au serveur, `null` pour l'effacer. */
export function qualiteAEnvoyer(saisie: string): string | null {
  const propre = saisie.replace(/\s+/g, ' ').trim();
  return propre === '' ? null : propre;
}
