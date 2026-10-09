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
