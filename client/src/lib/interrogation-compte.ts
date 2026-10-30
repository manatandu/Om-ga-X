/**
 * L'INTERROGATION DU COMPTE DEPUIS LA SAISIE (ligne gl-saisie, fonction 13) ·
 * ce que le serveur rend (`InterrogationCompteService`) et les deux lectures
 * de l'écran. Aucun calcul de solde ici · le serveur somme, l'écran présente.
 */
export interface SommeInterrogee {
  debit: number;
  credit: number;
  solde: number;
}

export interface LigneInterrogee {
  id: string;
  date: string;
  journal: string;
  numeroPiece: number | null;
  reference: string | null;
  libelle: string;
  debit: number;
  credit: number;
  statut: 'VALIDEE' | 'BROUILLARD';
  aNouveauProvisoire: boolean;
  lettre: string | null;
  lettragePartiel: boolean;
  dateEcheance: string | null;
}

export interface InterrogationCompte {
  compte: { id: string; numero: string; intitule: string; typeCompte: string; estActif: boolean };
  exercice: { id: string };
  livreJournal: SommeInterrogee;
  brouillard: SommeInterrogee;
  aNouveauProvisoire: SommeInterrogee;
  soldeAuJour: number;
  nombreLignes: number;
  lignes: LigneInterrogee[];
  tronque: boolean;
}

/** Le sens d'un solde · débiteur, créditeur, ou soldé au centime. */
export function sensDuSolde(solde: number): string {
  if (Math.abs(solde) < 0.005) return 'soldé';
  return solde > 0 ? 'débiteur' : 'créditeur';
}

/** Le lettrage d'une ligne · sa lettre, « partiel » pour un groupe non soldé, sinon rien. */
export function lettrageDeLaLigne(l: Pick<LigneInterrogee, 'lettre' | 'lettragePartiel'>): string {
  if (l.lettre) return l.lettre;
  return l.lettragePartiel ? 'partiel' : '';
}
