/**
 * LA CONCORDANCE À L'ÉCRAN (ligne microfina-m1, idée 12) · le contrat que le
 * serveur sert (`src/modules/concordance/concordance.ts`). Aucun calcul ici ·
 * l'écran nomme les états et montre les lignes.
 */
export type EtatConcordance = 'CONCORDE' | 'ECART' | 'NON_CALCULE' | 'SANS_OBJET';

export const LIBELLES_ETAT_CONCORDANCE: Record<EtatConcordance, string> = {
  CONCORDE: 'Concorde',
  ECART: 'Écart',
  NON_CALCULE: 'Non calculé',
  SANS_OBJET: 'Sans objet',
};

export interface LigneConcordance {
  reference: string;
  intitule: string;
  module: number | null;
  comptabilite: number | null;
  ecart: number | null;
}

export interface FamilleConcordance {
  cle: string;
  libelle: string;
  source: string;
  ecran: string;
  chemin: string;
  etat: EtatConcordance;
  motif: string | null;
  lignes: LigneConcordance[];
  mentions: string[];
}

export interface Concordance {
  exercice: { id: string; dateDebut: string; dateFin: string; statut: string };
  familles: FamilleConcordance[];
  synthese: { concordent: number; ecarts: number; nonCalculees: number; sansObjet: number };
}
