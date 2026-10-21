/**
 * LIGNE SAGE-L5, FONCTION 75 · ce que les écrans du paiement des salaires
 * lisent du serveur. Aucune règle ici · le reste à payer, les refus et le
 * billetage sont rejoués au serveur (`personnel/paiement-salaires.ts`).
 */

import type { VisaRibLu } from './visa-rib';

export type ModePaiement = 'VIREMENT' | 'CHEQUE' | 'ESPECES';

export const LIBELLE_MODE: Record<ModePaiement, string> = {
  VIREMENT: 'Virement',
  CHEQUE: 'Chèque',
  ESPECES: 'Espèces',
};

export const MODES: ModePaiement[] = ['VIREMENT', 'CHEQUE', 'ESPECES'];

export interface RibSalarieLu {
  id: string;
  banque: string;
  titulaire: string | null;
  codeBanque: string | null;
  codeGuichet: string | null;
  numeroCompte: string | null;
  cle: string | null;
  iban: string | null;
  codeBic: string | null;
  devise: string | null;
  estPrincipal: boolean;
  commentaire: string | null;
  coordonnees: string;
  /** Absent d'une réponse d'un serveur d'avant le visa. */
  visa?: VisaRibLu;
}

export interface PaiementDuSalarieLu {
  modePaiement: ModePaiement | null;
  ribs: RibSalarieLu[];
  total: number;
  tronque: boolean;
}

export interface LigneAPayer {
  bulletinId: string;
  numero: number;
  nature: 'MOIS' | 'DECOMPTE_FINAL';
  salarieId: string;
  nomComplet: string;
  netAPayer: number;
  dejaPayeAutres: number;
  montant: number;
  mode: ModePaiement | null;
  rib: string | null;
  passeAuJournal: boolean;
  remisLe: string | null;
}

export interface Billetage {
  coupures: number[];
  parSalarie: { salarieId: string; nomComplet: string; montant: number; detail: { valeur: number; nombre: number }[]; reste: number }[];
  totaux: { valeur: number; nombre: number }[];
  resteTotal: number;
}

export interface PaiementLu {
  id: string;
  mode: ModePaiement;
  date: string;
  journal: string;
  total: number;
  piecePassee: string;
  statutEcriture: 'BROUILLARD' | 'VALIDEE' | null;
  ordreVirement: { numero: number; statut: 'A_IMPRIMER' | 'IMPRIME' | 'ANNULE' } | null;
  billetage: Billetage | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  ecritureNegatif: boolean;
  lignes: { bulletinId: string; nomComplet: string; montant: number; reference: string | null }[];
}

export interface JournalDePaiement {
  id: string;
  code: string;
  intitule: string;
  compte: string | null;
  caisse: boolean;
  devise: string | null;
}

export interface PropositionPaiement {
  mois: string;
  echeanceArticle99: string;
  aPayer: LigneAPayer[];
  tropPayes: { bulletinId: string; numero: number; salarieId: string; nomComplet: string; netAPayer: number; dejaPaye: number; excedent: number }[];
  /** Relecture M5 · bulletins payés puis annulés, qu'aucun bulletin émis du mois ne remplace. */
  versementsSansBulletin: { bulletinId: string; numero: number; nomComplet: string; montant: number; pieces: { date: string; piece: string | null }[] }[];
  /** Relecture M4 · le 422 confronté à ce qui se propose sur des bulletins passés au journal · `null` sans rien à confronter. */
  confrontation422: { compte: string; solde: number; totalPasse: number; avertissement: string | null } | null;
  tronque: boolean;
  paiements: PaiementLu[];
  journaux: JournalDePaiement[];
  coupuresProposees: number[];
  billetage: Billetage | null;
}

/** Les journaux qu'un mode admet · une caisse pour les espèces, une banque sinon (règle rejouée au serveur). */
export function journauxDuMode(journaux: readonly JournalDePaiement[], mode: ModePaiement): JournalDePaiement[] {
  return journaux.filter((j) => j.compte !== null && (mode === 'ESPECES') === j.caisse);
}

/**
 * Les coupures tapées, séparées par des espaces ou des points-virgules, la
 * virgule étant celle des décimales (« 20000 10000 5000 0,50 ») · `null` si
 * une valeur est illisible, pour que l'écran le dise au lieu de l'écarter.
 */
export function lireCoupures(texte: string): number[] | null {
  const parties = texte.split(/[\s;]+/).filter((p) => p !== '');
  if (parties.length === 0) return [];
  const valeurs = parties.map((p) => Number(p.replace(',', '.')));
  return valeurs.every((v) => Number.isFinite(v) && v > 0) ? valeurs : null;
}
