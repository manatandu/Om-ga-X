/**
 * LA QUALITÉ DU TIERS (ligne sage-l2, fonction 24 · Sage 100 i7, plan
 * tiers, « Qualité » · « société, indépendant… »).
 *
 * UN LIBELLÉ, JAMAIS UNE RÈGLE · la qualité décrit le tiers sur sa fiche et
 * dans ses éditions. Aucun contrôle, aucun taux, aucune amende ne la lit ·
 * la qualité qui compte pour une règle se déclare là où la règle la lit (la
 * forme juridique du dossier, l'autorisation aux débits d'un fournisseur).
 * Une liste FERMÉE la ferait passer pour une qualification juridique que
 * personne n'a vérifiée · la liste est donc PROPOSÉE, la saisie reste libre.
 */

/** La longueur de la colonne (35, comme l'intitulé du tiers chez Sage). */
export const LONGUEUR_QUALITE = 35;

/** Les qualités proposées · une aide à la saisie, ni exhaustive ni contraignante. */
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

/**
 * La qualité telle qu'elle s'enregistre · espaces de bord retirés, blancs
 * intérieurs réduits à un. `undefined` reste absent (rien ne change) ; vide
 * ou `null` efface (le tiers n'a plus de qualité).
 */
export function normaliserQualite(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const propre = v.replace(/\s+/g, ' ').trim();
  return propre === '' ? null : propre;
}
