/**
 * D'OÙ VIENT CE CHIFFRE (ligne origine-des-montants) · le ZOOM de Sage 100
 * Comptabilité, repris sur les états financiers et les notes annexes · un
 * double-clic (ou Entrée) sur un montant ouvre le poste et ses comptes, un
 * double-clic sur un compte ouvre son grand livre, un double-clic sur une
 * ligne ouvre la pièce.
 *
 * L'écran ne recalcule RIEN · le poste, sa règle, ses comptes, leurs
 * contributions, le total et l'écart sont servis par le serveur depuis la
 * résolution qui a calculé l'état (`src/modules/etats-financiers/
 * origine-des-montants.ts`). Ce module ne porte que les types de la réponse
 * et l'adresse de la requête.
 */

export type EtatZoomable = 'bilan' | 'compte-de-resultat' | 'tableau-flux-tresorerie';
export type ColonneOrigine = 'N' | 'N1' | 'BRUT' | 'AMORTISSEMENT';

export interface ContributionCompte {
  numero: string;
  intitule: string;
  montant: number;
  compteId: string | null;
}

export interface GroupeOrigine {
  titre: string;
  lecture: string;
  motif: string | null;
  comptes: ContributionCompte[];
  sousTotal: number;
}

export interface ComposantOrigine {
  ref: string;
  libelle: string;
  signe: 1 | -1;
  montant: number | null;
}

export interface OrigineDuMontant {
  etat: EtatZoomable | 'note';
  ref: string;
  libelle: string;
  colonne: ColonneOrigine;
  montant: number | null;
  nature: 'COMPTES' | 'FORMULE' | 'HORS_BALANCE';
  regle: string | null;
  formule: string | null;
  groupes: GroupeOrigine[];
  composants: ComposantOrigine[];
  source: string | null;
  total: number | null;
  ecart: number | null;
  exerciceDesComptesId: string | null;
  mention: string | null;
}

/** Où se demande l'origine · la route des états du référentiel du dossier, ou celle de ses notes. */
export type SourceOrigine =
  | { type: 'etats'; base: '/etats-financiers' | '/etats-financiers-syscohada'; arreteAu?: string }
  | { type: 'notes'; base: '/notes-annexes/origine' | '/etats-financiers-syscohada/notes/origine'; jeu?: 'ASSOCIATIONS' | 'PROJETS' };

/** Une cellule désignée · un poste d'état, ou une ligne d'une note (son rang dans la note servie). */
export interface CelluleOrigine {
  etat: EtatZoomable | 'note';
  /** Le code du poste, ou pour une note son code (« 5A », « 29B »). */
  ref: string;
  colonne: ColonneOrigine;
  /** Sous-tableau d'une note qui en a plusieurs. */
  sousTableau?: string;
  /** Rang de la ligne dans la note servie. */
  ligne?: number;
}

export function adresseOrigine(source: SourceOrigine, exerciceId: string, c: CelluleOrigine): string {
  const p = new URLSearchParams({ exerciceId, ref: c.ref, colonne: c.colonne });
  if (source.type === 'etats') {
    p.set('etat', c.etat);
    if (source.arreteAu) p.set('arreteAu', source.arreteAu);
    return `${source.base}/origine?${p.toString()}`;
  }
  if (c.sousTableau) p.set('sousTableau', c.sousTableau);
  if (c.ligne !== undefined) p.set('ligne', String(c.ligne));
  if (source.jeu) p.set('jeu', source.jeu);
  return `${source.base}?${p.toString()}`;
}

export const LIBELLE_COLONNE: Record<ColonneOrigine, string> = {
  N: 'Exercice N',
  N1: 'Exercice N-1',
  BRUT: 'Brut N',
  AMORTISSEMENT: 'Amortissements et dépréciations N',
};

/** Une ligne de grand livre que les états ne lisent pas · le brouillard et le solde des comptes de gestion. */
export function horsDesEtats(l: { statut?: string; soldeDesComptesDeGestion?: boolean }): string | null {
  if (l.statut === 'BROUILLARD') return 'Brouillard';
  if (l.soldeDesComptesDeGestion) return 'Solde de gestion';
  return null;
}
