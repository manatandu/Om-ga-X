/**
 * EXTRAITS BANCAIRES ET LEUR ÉDITION CHAÎNÉE (ligne sage-l3, fonction 45 ·
 * Sage 100 Moyens de paiement, manuel de référence v16, p. 25 · « l'utilisateur
 * peut désormais imprimer successivement plusieurs extraits de compte à partir
 * de la liste des comptes bancaires » ; Prise en main, ch. 8 · consultation
 * des extraits par compte, puis par extrait, et impression).
 *
 * Dans OmegaX, un extrait est le relevé importé dans un rapprochement
 * (`LigneReleveBancaire`, une liste par rapprochement) · ce module porte les
 * règles PURES de la liste et de l'édition, le service lit la base.
 *
 * DÉCISION D14 (architecture.md) · AUDCIF art. 22, 7° · « chaque donnée entrée
 * par transmission d'un autre système doit être appuyée d'une pièce
 * justificative probante » · le relevé reçu de la banque EST cette pièce,
 * conservée (art. 24) ; l'édition d'OmegaX n'en est qu'une RECONSTITUTION
 * depuis les lignes importées · elle est datée (tirage), dit le fichier et
 * l'instant de l'import, et porte la mention qui l'écarte de la pièce. Elle
 * n'est pas numérotée · ce n'est pas un état périodique de l'entité, c'est la
 * copie d'un document reçu.
 */

import type { ColonneFpm, EnteteFpm } from '../exports/presentation-fpm';
import { arrondi } from './releve-bancaire';

/** Une ligne d'extrait telle que le service la sert à l'édition. */
export interface LigneExtrait {
  rang: number;
  date: Date;
  libelle: string;
  reference: string | null;
  debit: number;
  credit: number;
  /** Vrai quand une ligne du livre ou un en-cours d'ouverture lui est rapproché. */
  rapprochee: boolean;
}

/** Ce que la liste sert pour un extrait · la tête du rapprochement et ses nombres. */
export interface TeteExtrait {
  rapprochementId: string;
  compteId: string;
  compteNumero: string;
  compteNom: string;
  dateReleve: Date;
  soldeReleve: number;
  /** Solde de départ du relevé · celui du rapprochement précédent ou déclaré, `null` s'il manque. */
  soldeDepart: number | null;
  /** Total des mouvements du relevé, vu du compte (crédits moins débits de la banque). */
  mouvementsNet: number;
  /** Sommes des débits et des crédits de la banque, au centime · confrontées aux lignes relues par l'édition. */
  totalDebit: number;
  totalCredit: number;
  /** Solde de départ plus mouvements moins solde imprimé · `null` sans solde de départ. */
  ecartReleve: number | null;
  nombreLignes: number;
  nombreRapprochees: number;
  statut: 'EN_COURS' | 'CLOTURE';
  releveImporteLe: Date | null;
  releveNomFichier: string | null;
}

/**
 * La liste des extraits se sert par TRANCHE, et une édition chaînée réunit au
 * plus cette tranche · au-delà, la SÉLECTION (comptes, dates) se restreint, et
 * le refus le dit (§ 8 bis). La troncature se juge sur la sélection demandée,
 * jamais sur le dossier entier (premier tour de relecture, BLOQUANT B1 · un
 * dossier de 240 relevés ne pouvait plus rien éditer, pas même un compte sur
 * un mois, et le refus nommait une issue qui ne levait rien).
 */
export const LIMITE_EXTRAITS = 200;

/** La mention en ligne 7 de chaque feuille · ce que l'édition est, et n'est pas. */
export const MENTION_EXTRAIT =
  "Reconstitué depuis le fichier importé · la pièce probante reste le relevé reçu de la banque, conservé (AUDCIF art. 22, 7° et art. 24)";

/** Les colonnes de la feuille d'un extrait, présentation du cabinet (FPM). */
export const COLONNES_EXTRAIT_FPM: ColonneFpm[] = [
  { cle: 'rang', largeur: 6, genre: 'texte', filetGauche: true },
  { cle: 'date', largeur: 10, genre: 'date' },
  { cle: 'libelle', largeur: 44, genre: 'texte' },
  { cle: 'reference', largeur: 16, genre: 'texte', filetDroit: true },
  { cle: 'debit', largeur: 16, genre: 'montant' },
  { cle: 'credit', largeur: 16, genre: 'montant', filetDroit: true },
  { cle: 'solde', largeur: 16, genre: 'montant', filetDroit: true },
  { cle: 'rapprochee', largeur: 11, genre: 'texte', filetDroit: true },
];

export const ENTETES_EXTRAIT_FPM: EnteteFpm[] = [
  { colonne: 1, ligne: 0, texte: 'N°' },
  { colonne: 2, ligne: 0, texte: 'Date' },
  { colonne: 3, ligne: 0, texte: 'Libellé' },
  { colonne: 4, ligne: 0, texte: 'Référence' },
  { colonne: 5, ligne: 0, texte: 'Débit (banque)' },
  { colonne: 6, ligne: 0, texte: 'Crédit (banque)' },
  { colonne: 7, ligne: 0, texte: 'Solde' },
  { colonne: 8, ligne: 0, texte: 'Rapprochée' },
];

/**
 * LE SENS DE LA BANQUE · un crédit du relevé est une entrée pour l'entité
 * (règle (1) du relevé, `montantVuDuCompte`) · le solde progressif part du
 * solde de départ et ajoute crédits moins débits. Sans solde de départ, la
 * colonne reste vide · un zéro présumé ferait lire un solde faux.
 */
export function soldesProgressifs(soldeDepart: number | null, lignes: readonly LigneExtrait[]): (number | null)[] {
  if (soldeDepart === null) return lignes.map(() => null);
  let solde = soldeDepart;
  return lignes.map((l) => {
    solde = arrondi(solde + l.credit - l.debit);
    return solde;
  });
}

/**
 * LE JOUR D'UNE DATE, en UTC (AAAA-MM-JJ) · la date d'un relevé est reçue par
 * `@IsDateString` et peut porter une heure ; bornes, noms de feuille et
 * période se jugent sur le JOUR, jamais sur l'instant (premier tour de
 * relecture, constat 8 · un relevé du jour « au » daté à dix heures sortait
 * des bornes).
 */
export const jourIso = (d: Date): string => d.toISOString().slice(0, 10);

/** Le lendemain d'un jour à minuit UTC · borne haute EXCLUE d'une requête sur une date qui peut porter une heure. */
export const lendemain = (jour: Date): Date => new Date(Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate() + 1));

/** Le nom de la feuille d'un extrait · le numéro du compte et la date du relevé, borné à 31 caractères (Excel). */
export function nomDeFeuilleExtrait(compteNumero: string, dateReleve: Date, dejaPris: Set<string>): string {
  // Excel refuse [ ] : * ? / \ et une apostrophe en tête ou en fin · un
  // numéro est fait de chiffres en pratique, mais rien ne le garantit à cette
  // porte, et un nom refusé tomberait APRÈS le premier octet.
  const numero = compteNumero.replace(/[[\]:*?/\\]/g, '_').replace(/^'+|'+$/g, '') || '_';
  const base = `${numero} ${jourIso(dateReleve)}`.slice(0, 31);
  let nom = base;
  let k = 2;
  while (dejaPris.has(nom)) {
    const suffixe = ` (${k})`;
    nom = `${base.slice(0, 31 - suffixe.length)}${suffixe}`;
    k += 1;
  }
  dejaPris.add(nom);
  return nom;
}

/** Les critères d'une édition chaînée, tels que la route les reçoit. */
export interface SelectionExtraits {
  /** Comptes de banque choisis · vide, tous ceux qui portent un extrait. */
  compteIds: string[];
  /** Bornes sur la DATE DU RELEVÉ, incluses · `null` sans borne. */
  du: Date | null;
  au: Date | null;
}

/** Les années admises dans une borne de sélection · convention d'OmegaX, aucun relevé n'est hors de cette plage. */
export const ANNEE_MIN_SELECTION = 1900;
export const ANNEE_MAX_SELECTION = 9998;

/**
 * Le refus d'une sélection illisible, nommé · une borne qui n'est pas un jour,
 * un « du » après le « au ». Le service refuse à part un compte qui n'est pas
 * du dossier.
 */
export function motifRefusSelection(s: { compteIds?: string; du?: string; au?: string }): string | null {
  const nombreDeComptes = (s.compteIds ?? '').split(',').filter((c) => c.trim().length > 0).length;
  if (nombreDeComptes > LIMITE_EXTRAITS) return `${nombreDeComptes} comptes choisis, au-delà des ${LIMITE_EXTRAITS} qu'une édition chaînée réunit.`;
  // Un « 2026-02-31 » glisse au 3 mars sans NaN · le jour relu doit être celui écrit.
  const estUnJour = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const t = Date.parse(`${v}T00:00:00.000Z`);
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v) return false;
    // Une année hors 1900 à 9998 est refusée nommée (second tour, constat
    // mineur 2) · le lendemain du 31 décembre 9999 sort du format ISO à
    // quatre chiffres, et la base le refuserait APRÈS la lecture de la liste.
    const annee = Number(v.slice(0, 4));
    return annee >= ANNEE_MIN_SELECTION && annee <= ANNEE_MAX_SELECTION;
  };
  if (s.du !== undefined && s.du !== '' && !estUnJour(s.du))
    return `La borne « du » doit être un jour (AAAA-MM-JJ), entre ${ANNEE_MIN_SELECTION} et ${ANNEE_MAX_SELECTION}.`;
  if (s.au !== undefined && s.au !== '' && !estUnJour(s.au))
    return `La borne « au » doit être un jour (AAAA-MM-JJ), entre ${ANNEE_MIN_SELECTION} et ${ANNEE_MAX_SELECTION}.`;
  if (s.du && s.au && s.du > s.au) return 'La borne « du » est postérieure à la borne « au ».';
  return null;
}

/** Lit la sélection d'une requête déjà jugée lisible. */
export function lireSelection(q: { compteIds?: string; du?: string; au?: string }): SelectionExtraits {
  const compteIds = (q.compteIds ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return {
    compteIds: [...new Set(compteIds)],
    du: q.du ? new Date(`${q.du}T00:00:00.000Z`) : null,
    au: q.au ? new Date(`${q.au}T00:00:00.000Z`) : null,
  };
}

/**
 * L'ORDRE DE L'ÉDITION CHAÎNÉE · compte par compte (numéro croissant), puis
 * chaque extrait du plus ancien au plus récent par sa date de relevé · celui
 * qui lit l'édition suit la chronologie de la banque. Les extraits hors
 * bornes sortent ; un compte sans extrait dans les bornes ne fait aucune
 * feuille, et l'édition le DIT (le service rend les comptes vides).
 */
export function ordonnerExtraits<T extends { compteNumero: string; dateReleve: Date; rapprochementId: string }>(
  extraits: readonly T[],
  s: SelectionExtraits,
): T[] {
  return extraits
    .filter((e) => (s.du === null || jourIso(e.dateReleve) >= jourIso(s.du)) && (s.au === null || jourIso(e.dateReleve) <= jourIso(s.au)))
    .slice()
    .sort((a, b) => a.compteNumero.localeCompare(b.compteNumero) || a.dateReleve.getTime() - b.dateReleve.getTime() || a.rapprochementId.localeCompare(b.rapprochementId));
}

/**
 * LA PÉRIODE DU CLASSEUR · les bornes demandées, sinon le plus ancien et le
 * plus récent des relevés RETENUS (min et max, jamais le premier et le
 * dernier de l'ordre compte-puis-date · premier tour de relecture, M3 · un
 * classeur de janvier et février disait « du 31/01 au 31/01 » parce que le
 * dernier compte n'avait qu'un relevé de janvier).
 */
export function periodeDesExtraits(retenus: readonly { dateReleve: Date }[], s: SelectionExtraits): { debut: Date; fin: Date } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const e of retenus) {
    const t = e.dateReleve.getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return { debut: s.du ?? new Date(min), fin: s.au ?? new Date(max) };
}

/** Le solde après une ligne · la même règle que `soldesProgressifs`, ligne à ligne, pour une lecture par lots. */
export function soldeApres(solde: number | null, l: Pick<LigneExtrait, 'debit' | 'credit'>): number | null {
  return solde === null ? null : arrondi(solde + l.credit - l.debit);
}

/** Les totaux d'un extrait, sur les lignes ARRONDIES comme elles sont servies. */
export function totauxExtrait(lignes: readonly LigneExtrait[]): { debit: number; credit: number; net: number } {
  const debit = arrondi(lignes.reduce((s, l) => s + l.debit, 0));
  const credit = arrondi(lignes.reduce((s, l) => s + l.credit, 0));
  return { debit, credit, net: arrondi(credit - debit) };
}

/**
 * Le libellé de la période imprimée en cartouche · du premier au dernier jour
 * des lignes, la date du relevé comprise, sinon elle seule. Depuis un agrégat
 * (la feuille se pose avant ses lignes, lues par lots) ou depuis les lignes.
 */
export function bornesDepuisLesDates(tete: { dateReleve: Date }, premiere: Date | null, derniere: Date | null): { debut: Date; fin: Date } {
  if (premiere === null || derniere === null) return { debut: tete.dateReleve, fin: tete.dateReleve };
  return { debut: premiere, fin: derniere.getTime() > tete.dateReleve.getTime() ? derniere : tete.dateReleve };
}

export function bornesDeLExtrait(tete: { dateReleve: Date }, lignes: readonly LigneExtrait[]): { debut: Date; fin: Date } {
  // Une boucle, jamais un étalement `Math.min(...)` · au-delà d'environ cent
  // mille lignes V8 lève une RangeError, après le premier octet.
  let premiere: Date | null = null;
  let derniere: Date | null = null;
  for (const l of lignes) {
    if (premiere === null || l.date.getTime() < premiere.getTime()) premiere = l.date;
    if (derniere === null || l.date.getTime() > derniere.getTime()) derniere = l.date;
  }
  return bornesDepuisLesDates(tete, premiere, derniere);
}
