/**
 * MODÈLES D'IMPRESSION DES TIERS (ligne sage-l2, fonction 27) · ce que
 * l'écran sait d'un modèle, et rien de plus. Les natures, leurs libellés, les
 * jetons et le plafond sont le MIROIR de l'énumération
 * `NatureModeleImpression` du schéma et des règles du serveur
 * (`src/modules/tiers/modeles-impression.ts`) · le spec relit les deux
 * fichiers et tombe dès qu'ils divergent. Le serveur juge le texte ({document}
 * une fois, aucun jeton inconnu) et l'écran dit son refus.
 */
export type NatureModeleImpression = 'EXTRAIT' | 'REGLEMENT' | 'RAPPEL';

export const LIBELLES_NATURE_MODELE: Readonly<Record<NatureModeleImpression, string>> = {
  EXTRAIT: 'Extrait de compte',
  REGLEMENT: 'Avis de règlement',
  RAPPEL: 'Rappel',
};

/** L'ordre des listes · celui de l'énumération. */
export const NATURES_MODELE: readonly NatureModeleImpression[] = Object.keys(LIBELLES_NATURE_MODELE) as NatureModeleImpression[];

/** Cent modèles au plus par dossier, la borne du serveur. */
export const PLAFOND_MODELES_IMPRESSION = 100;
export const LONGUEUR_INTITULE_MODELE = 35;
export const LONGUEUR_TEXTE_MODELE = 4000;

/** Les jetons qu'un modèle peut porter · ceux du serveur, dans son ordre. */
export const JETONS_MODELE_IMPRESSION: readonly string[] = ['document', 'tiers', 'code', 'qualite', 'contact', 'adresse', 'entite', 'date'];

/** Ce que chaque document est, et où il s'imprime · dit dans la bulle. */
export const OU_SERT_LE_MODELE: Readonly<Record<NatureModeleImpression, string>> = {
  EXTRAIT: 'Le relevé de Rappel et relevé, à l’écran et en courrier.',
  REGLEMENT: 'L’avis de règlement d’un ordre de virement imprimé.',
  RAPPEL: 'La relance préventive et les rappels.',
};

export interface ModeleImpression {
  id: string;
  nature: NatureModeleImpression;
  intitule: string;
  texte: string;
  /** Combien de tiers l'ont choisi · c'est ce qui le retient à la suppression. */
  nombreTiers: number;
}

/** La zone de la fiche du tiers où se choisit le modèle d'une nature. */
export const ZONE_DU_TIERS: Readonly<
  Record<NatureModeleImpression, 'modeleImpressionExtraitId' | 'modeleImpressionReglementId' | 'modeleImpressionRappelId'>
> = {
  EXTRAIT: 'modeleImpressionExtraitId',
  REGLEMENT: 'modeleImpressionReglementId',
  RAPPEL: 'modeleImpressionRappelId',
};

/** Les modèles qu'une zone propose · ceux de sa nature, par intitulé. */
export function modelesDeLaNature<M extends Pick<ModeleImpression, 'nature' | 'intitule'>>(modeles: readonly M[], nature: NatureModeleImpression): M[] {
  return modeles.filter((m) => m.nature === nature).sort((a, b) => a.intitule.localeCompare(b.intitule, 'fr'));
}

/** Le texte de départ d'un nouveau modèle · le jeton du document, à sa place. */
export const TEXTE_DE_DEPART = 'À l’attention de {contact}\n{tiers}\n{adresse}\n\n{document}';

/** La bulle des jetons, une ligne. */
export const AIDE_JETONS_MODELE =
  '{document} le document composé par OmegaX, exigé une fois · {tiers} le nom du tiers · {code} son code · {qualite} sa qualité · ' +
  '{contact} la personne à qui la lettre s’adresse · {adresse} l’adresse de la fiche · {entite} le nom du dossier · {date} le jour du document.';
