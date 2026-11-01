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
  /** Une rubrique de note · son rang dans la note servie. */
  ligne?: number;
  /** Le composant ne s'ouvre pas, et pourquoi (poste retiré de l'état, rubrique non chiffrée ou ambiguë). */
  nonOuvrable?: string;
}

/**
 * LA CELLULE QU'OUVRE UN COMPOSANT D'UN TOTAL · un poste d'état se désigne
 * par son code, une rubrique de note par son RANG dans la note servie (le code
 * est celui de la note, le même que le total). Reprendre la cellule du total
 * en ne changeant que le code rouvrait le total sur une note · une boucle,
 * relevée à la relecture du 2026-11-01. `null` · le composant ne s'ouvre pas.
 */
export function celluleDuComposant(cellule: CelluleOrigine, c: ComposantOrigine): CelluleOrigine | null {
  if (c.nonOuvrable) return null;
  if (cellule.etat === 'note') return c.ligne === undefined ? null : { ...cellule, ligne: c.ligne };
  return { ...cellule, ref: c.ref };
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

/**
 * Une ligne de grand livre que les états ne lisent pas · le brouillard,
 * l'à-nouveau provisoire (jamais validé) et le solde des comptes de gestion.
 */
export function horsDesEtats(l: { statut?: string; soldeDesComptesDeGestion?: boolean; aNouveauProvisoire?: boolean }): string | null {
  if (l.aNouveauProvisoire) return 'À-nouveau provisoire';
  if (l.statut === 'BROUILLARD') return 'Brouillard';
  if (l.soldeDesComptesDeGestion) return 'Solde de gestion';
  return null;
}

/**
 * Le solde des seules lignes que les états lisent (débit − crédit) · dit à
 * côté du solde du livre, pour que la contribution se recoupe sans deviner
 * ce qui en sort (relecture du 2026-11-01, mineur 4). La contribution peut
 * encore différer par le signe ou la colonne que le poste lit (passif lu au
 * crédit, variation, mouvements seuls), et la bulle le dit.
 */
export function soldeLuParLesEtats(lignes: ReadonlyArray<{ debit: number; credit: number; statut?: string; soldeDesComptesDeGestion?: boolean; aNouveauProvisoire?: boolean }>): number {
  return Math.round(lignes.filter((l) => horsDesEtats(l) === null).reduce((s, l) => s + l.debit - l.credit, 0) * 100) / 100 || 0;
}

/**
 * Le grand livre du compte, BORNÉ à ce que l'état lit · une situation
 * intermédiaire arrête la lecture à sa date (`au`, période de l'exercice,
 * route bornée existante), sur la colonne de l'exercice qu'elle arrête.
 */
export function adresseGrandLivre(compteId: string, exerciceId: string, au?: string): string {
  return `/ecritures/grand-livre/${compteId}?exerciceId=${exerciceId}${au ? `&au=${au}` : ''}`;
}
