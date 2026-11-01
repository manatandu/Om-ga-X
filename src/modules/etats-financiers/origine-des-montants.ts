import { BadRequestException } from '@nestjs/common';
import type { CompteDuPoste } from './etats-financiers.communs';

/**
 * D'OÙ VIENT CE CHIFFRE (ligne origine-des-montants, gel levé par Manasse le
 * 2026-11-01, « Enchaîne le point 3 et 4 »).
 *
 * LE MODÈLE EST LE ZOOM DE SAGE 100 COMPTABILITÉ · dans ses éditions et ses
 * états de synthèse, un double-clic sur un montant ouvre le détail des comptes
 * qui le font, un double-clic sur un compte ouvre son grand livre, un
 * double-clic sur une ligne ouvre la pièce. OmegaX reprend cette remontée,
 * montant par montant, sur les états financiers des deux référentiels et sur
 * les notes annexes chiffrées.
 *
 * CE QUI EST SERVI EST CE QUI A CALCULÉ · aucun écran ne rejoue une table de
 * correspondance. Chaque service d'états construit l'origine depuis la MÊME
 * résolution que l'état qu'il sert (mêmes lignes de balance, mêmes postes,
 * mêmes termes), et ce module ne fait que la mettre en forme, additionner et
 * dire l'écart. Un écart non nul n'est jamais caché · il est servi au
 * centime, et c'est la seule chose qu'un test parcourant tous les postes
 * d'un jeu d'essai doit trouver nulle.
 *
 * Aides TECHNIQUES seulement, communes aux deux référentiels comme
 * `etats-financiers.communs.ts` · aucun poste, aucun compte, aucun libellé
 * d'état ici (CLAUDE.md § 6).
 */

export const ETATS_ZOOMABLES = ['bilan', 'compte-de-resultat', 'tableau-flux-tresorerie'] as const;
export type EtatZoomable = (typeof ETATS_ZOOMABLES)[number];

/**
 * La colonne cliquée · N et N-1 partout, BRUT et AMORTISSEMENT sur l'actif
 * du bilan seulement (le modèle n'en imprime pas ailleurs).
 */
export const COLONNES_ORIGINE = ['N', 'N1', 'BRUT', 'AMORTISSEMENT'] as const;
export type ColonneOrigine = (typeof COLONNES_ORIGINE)[number];

export interface ContributionCompte {
  numero: string;
  intitule: string;
  /** Ce que le compte apporte au montant, dans le signe où le calcul l'additionne. */
  montant: number;
  /** Résolu sur le plan du dossier pour ouvrir le grand livre · `null` si le numéro n'y est plus. */
  compteId: string | null;
}

/**
 * Un groupe de comptes lus de la même façon · « Brut » et « Amortissements »
 * d'un poste d'actif, un terme d'une formule du tableau des flux, les
 * mouvements de l'exercice et les créances d'ouverture et de clôture d'un
 * flux du SYCEBNL. `lecture` dit la colonne de la balance et le signe.
 */
export interface GroupeOrigine {
  titre: string;
  lecture: string;
  /** Pourquoi ce groupe entre dans le montant, avec sa source · repris de la table quand elle le dit. */
  motif: string | null;
  comptes: ContributionCompte[];
  sousTotal: number;
}

/** Un poste qui entre dans un total, avec le signe de la formule. */
export interface ComposantOrigine {
  ref: string;
  libelle: string;
  signe: 1 | -1;
  /** `null` · le composant est laissé vide par l'état (jamais un zéro). */
  montant: number | null;
  /** Une rubrique de note · son rang dans la note servie, absent quand elle n'y est pas présentée. */
  ligne?: number;
}

export type NatureOrigine = 'COMPTES' | 'FORMULE' | 'HORS_BALANCE';

export interface OrigineDuMontant {
  etat: EtatZoomable | 'note';
  ref: string;
  libelle: string;
  colonne: ColonneOrigine;
  /** Le montant que l'état affiche dans cette cellule · `null` quand il la laisse vide. */
  montant: number | null;
  nature: NatureOrigine;
  /** La correspondance lue, telle que la table l'écrit (préfixes, exclusions, sens). */
  regle: string | null;
  /** La formule du modèle d'un total (« Somme TA à RB ») quand elle est imprimée. */
  formule: string | null;
  groupes: GroupeOrigine[];
  composants: ComposantOrigine[];
  /** Pour un montant hors balance ou laissé vide · d'où il vient, ou pourquoi il manque. */
  source: string | null;
  /** Somme des contributions ou des composants · `null` si un composant est vide. */
  total: number | null;
  /** Montant affiché moins total, au centime · `null` quand rien ne se compare. */
  ecart: number | null;
  /** L'exercice dont le grand livre porte ces comptes · `null` quand il n'y en a pas dans le dossier. */
  exerciceDesComptesId: string | null;
  /** Ce qu'il faut savoir pour lire la colonne (comparatif lu sur l'ouverture, variation N − N-1). */
  mention: string | null;
}

export const MOTIF_ETAT_ILLISIBLE = `État inconnu · attendu ${ETATS_ZOOMABLES.join(', ')}.`;
export const MOTIF_COLONNE_ILLISIBLE = `Colonne inconnue · attendu ${COLONNES_ORIGINE.join(', ')}.`;
export const MOTIF_REF_ILLISIBLE = 'Code du poste illisible.';
export const MOTIF_POSTE_INTROUVABLE = "Ce poste n'existe pas dans cet état.";
export const MOTIF_COLONNE_SANS_OBJET = "Cette colonne n'existe pas pour ce poste.";

export function lireEtatZoomable(brut: unknown): EtatZoomable {
  if (typeof brut === 'string' && (ETATS_ZOOMABLES as readonly string[]).includes(brut)) return brut as EtatZoomable;
  throw new BadRequestException(MOTIF_ETAT_ILLISIBLE);
}

export function lireColonneOrigine(brut: unknown): ColonneOrigine {
  if (brut === undefined || brut === '') return 'N';
  if (typeof brut === 'string' && (COLONNES_ORIGINE as readonly string[]).includes(brut)) return brut as ColonneOrigine;
  throw new BadRequestException(MOTIF_COLONNE_ILLISIBLE);
}

/**
 * Le code d'un poste · lettres et chiffres, au plus six (« RQP », « 5A »).
 * La ligne intercalée du tableau des flux SYSCOHADA, qui n'a pas de code au
 * modèle, se désigne par une chaîne vide (`''`), seule exception.
 */
export function lireRefPoste(brut: unknown): string {
  if (brut === '' || brut === undefined) return '';
  if (typeof brut === 'string' && /^[A-Z0-9]{1,6}$/.test(brut)) return brut;
  throw new BadRequestException(MOTIF_REF_ILLISIBLE);
}

export const MOTIF_LIGNE_DE_NOTE_ILLISIBLE = 'Ligne de note illisible · attendu son rang dans la note, à partir de 0.';
export const MOTIF_COLONNE_DE_NOTE = 'Seules les colonnes « Exercice N » (N) et « Exercice N-1 » (N1) d’une note se remontent.';

/** Le rang d'une ligne dans la note servie · un entier positif ou nul. */
export function lireLigneDeNote(brut: unknown): number {
  if (typeof brut === 'string' && /^\d{1,4}$/.test(brut)) return Number(brut);
  throw new BadRequestException(MOTIF_LIGNE_DE_NOTE_ILLISIBLE);
}

/** La colonne d'une note · N ou N-1, les seules que l'origine sert. */
export function lireColonneDeNote(brut: unknown): 'N' | 'N1' {
  const c = lireColonneOrigine(brut);
  if (c === 'N' || c === 'N1') return c;
  throw new BadRequestException(MOTIF_COLONNE_DE_NOTE);
}

/** Le code d'une note (« 5A », « 29B ») et son sous-tableau éventuel · lettres, chiffres et tirets. */
export function lireCodeDeNote(brut: unknown): string {
  if (typeof brut === 'string' && /^[A-Za-z0-9-]{1,12}$/.test(brut)) return brut;
  throw new BadRequestException(MOTIF_REF_ILLISIBLE);
}

/** Le titre d'un sous-tableau de note, tel que la note le sert (« ENGAGEMENTS FINANCIERS ») · comparé, jamais interprété. */
export function lireSousTableau(brut: unknown): string | undefined {
  if (brut === undefined || brut === '') return undefined;
  if (typeof brut === 'string' && brut.length <= 200) return brut;
  throw new BadRequestException(MOTIF_REF_ILLISIBLE);
}

/** Écart au centime · un reste de flottant n'est pas un écart, et -0 se dit 0. */
export function ecartAuCentime(montant: number, total: number): number {
  return Math.round((montant - total) * 100) / 100 || 0;
}

/** Les comptes d'un poste, recopiés tels que le calcul les a lus, sans identifiant encore. */
export function contributions(comptes: readonly CompteDuPoste[], signe: 1 | -1 = 1): ContributionCompte[] {
  return comptes.map((c) => ({ numero: c.numero, intitule: c.intitule, montant: signe * c.montant || 0, compteId: null }));
}

export function groupe(titre: string, lecture: string, comptes: ContributionCompte[], motif: string | null = null): GroupeOrigine {
  return { titre, lecture, motif, comptes, sousTotal: comptes.reduce((s, c) => s + c.montant, 0) || 0 };
}

interface EnTete {
  etat: OrigineDuMontant['etat'];
  ref: string;
  libelle: string;
  colonne: ColonneOrigine;
  montant: number | null;
  regle?: string | null;
  formule?: string | null;
  exerciceDesComptesId: string | null;
  mention?: string | null;
}

/** Un montant fait de comptes · le total est la somme des groupes, l'écart se dit. */
export function origineParComptes(t: EnTete, groupes: GroupeOrigine[]): OrigineDuMontant {
  const total = groupes.reduce((s, g) => s + g.sousTotal, 0) || 0;
  return {
    ...base(t),
    nature: 'COMPTES',
    groupes: groupes.filter((g) => g.comptes.length > 0),
    total,
    ecart: t.montant === null ? null : ecartAuCentime(t.montant, total),
  };
}

/**
 * Un total ou un solde fait d'autres postes · le total recalculé est la somme
 * signée des composants tels que l'état les affiche. Un composant laissé vide
 * rend le total incalculable, jamais un zéro.
 */
export function origineParFormule(t: EnTete, composants: ComposantOrigine[]): OrigineDuMontant {
  const vide = composants.some((c) => c.montant === null);
  const total = vide ? null : composants.reduce((s, c) => s + c.signe * (c.montant as number), 0) || 0;
  return {
    ...base(t),
    nature: 'FORMULE',
    composants,
    total,
    ecart: t.montant === null || total === null ? null : ecartAuCentime(t.montant, total),
  };
}

/** Un montant qui ne vient pas de la balance, ou une cellule laissée vide · sa source dite. */
export function origineHorsBalance(t: EnTete, source: string): OrigineDuMontant {
  return { ...base(t), nature: 'HORS_BALANCE', source, total: null, ecart: null };
}

function base(t: EnTete): OrigineDuMontant {
  return {
    etat: t.etat,
    ref: t.ref,
    libelle: t.libelle,
    colonne: t.colonne,
    montant: t.montant,
    nature: 'COMPTES',
    regle: t.regle ?? null,
    formule: t.formule ?? null,
    groupes: [],
    composants: [],
    source: null,
    total: null,
    ecart: null,
    exerciceDesComptesId: t.exerciceDesComptesId,
    mention: t.mention ?? null,
  };
}

/**
 * La correspondance d'un poste, écrite comme la table la porte · préfixes,
 * exclusions, sens du solde. C'est la lecture de la règle, pas une seconde
 * règle · elle se compose des champs de la table elle-même.
 */
export function regleDesPrefixes(
  prefixes: readonly string[] | undefined,
  exclusions?: readonly string[],
  sens?: 'DEBITEUR' | 'CREDITEUR',
): string {
  const lus = prefixes && prefixes.length > 0 ? `Comptes ${prefixes.join(', ')}` : 'Aucun compte';
  const sauf = exclusions && exclusions.length > 0 ? ` sauf ${exclusions.join(', ')}` : '';
  const s = sens === 'DEBITEUR' ? ', soldes débiteurs seulement' : sens === 'CREDITEUR' ? ', soldes créditeurs seulement' : '';
  return `${lus}${sauf}${s}`;
}
