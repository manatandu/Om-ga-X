import { montant } from './montants';
import type { ResultatAnterieurNonVire } from './types';

/**
 * LES PHRASES DE L'AVIS DU RÉSULTAT ANTÉRIEUR NON VIRÉ, hors du composant
 * (paquet 1, A1) · les specs client ne chargent jamais React
 * (`specs-sans-react.spec.ts`), c'est donc ici que le texte affiché se teste.
 * Le serveur tranche et sert les deux avis (`resultatAnterieurNonVire` pour
 * l'exercice, `resultatAnterieurNonVireN1` pour sa colonne N-1) ; l'écran les
 * dit, le motif qui cite la fiche du compte 13 va dans la bulle.
 */
export const TITRE_AVIS_EXERCICE = "Résultat de l'exercice précédent non viré";
export const TITRE_AVIS_COLONNE_N1 = 'Colonne N-1 · résultat antérieur non viré';

export function phraseAvisExercice(avis: ResultatAnterieurNonVire): string {
  return (
    `Le poste ${avis.poste} inclut ${montant(avis.montant)} de résultat de l'exercice précédent, resté au compte 13 à la ` +
    'clôture.'
  );
}

/**
 * La colonne N-1 reprend le poste tel que l'exercice précédent l'a présenté,
 * rien n'est recalculé (AUDCIF art. 34 ; SYCEBNL art. 16, 7)) · la phrase nomme
 * la colonne, sans quoi elle se lirait comme un défaut de l'exercice affiché.
 */
export function phraseAvisColonneN1(avis: ResultatAnterieurNonVire): string {
  return (
    `En colonne N-1, le poste ${avis.poste} inclut ${montant(avis.montant)} de résultat antérieur, resté au compte 13 à la ` +
    "clôture de l'exercice précédent."
  );
}

/**
 * LE 130 AU POSTE RÉSULTAT (paquet 1, A6, décision de Manasse du 2026-10-09).
 * Le serveur sert la part du poste au 130 (`resultatEnInstance`) · l'écran dit
 * ce que le poste contient, sans le recalculer.
 */
export const TITRE_RESULTAT_EN_INSTANCE = "Résultat en instance d'affectation";
export const AIDE_RESULTAT_EN_INSTANCE =
  "AUDCIF, Titre VII, compte 13 · « À la réouverture des comptes de l'exercice suivant, les entités ont la possibilité " +
  "d'utiliser un compte spécial \"Résultat en instance d'affectation\" (130) » ; « le compte 13 est donc soldé lors de la " +
  "comptabilisation de cette affectation ». L'affectation solde le 130 ; ce qui reste non affecté en fin d'exercice est " +
  'viré au report à nouveau.';

export function phraseResultatEnInstance(part: number): string {
  const sens = part >= 0 ? 'bénéfice' : 'perte';
  return `Le poste résultat comprend ${montant(Math.abs(part))} (${sens}) au compte 130 · le résultat de l'exercice précédent, en attente de son affectation.`;
}
