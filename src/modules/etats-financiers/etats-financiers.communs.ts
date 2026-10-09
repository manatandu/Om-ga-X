import { NotFoundException } from '@nestjs/common';
import { ClasseCompte, StatutExercice, TypeCompteDetailTotal } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import { avantSoldeDesComptesDeGestion } from '../comptabilite/balance-trois-colonnes';
import { MOTIF_EXERCICE_INTROUVABLE } from '../../common/exercice-introuvable';

/**
 * Aides communes aux états financiers, extraites ici lors de la construction
 * du jeu « projets de développement » (2026-08-28) pour ne pas dupliquer une
 * logique déjà écrite et testée pour le jeu « associations ». Elles servent
 * aujourd'hui les trois jeux SYCEBNL (associations, projets, Système minimal
 * de trésorerie) et, au-delà, les états SYSCOHADA des deux systèmes, les
 * notes annexes, les états IFRS, la consolidation et le registre des
 * donateurs · tous lisent ainsi la balance de la même façon (audit final
 * F212, le commentaire annonçait encore un Système minimal « non construit »).
 */

/** Un compte rattaché à un poste, avec sa contribution · permet le drill-down. */
export interface CompteDuPoste {
  numero: string;
  intitule: string;
  montant: number;
}

/** Une ligne de balance déjà agrégée par compte (voir EcritureService.balance()). */
export interface LigneBalancePourEtat {
  compteId: string;
  numero: string;
  intitule: string;
  classe: ClasseCompte;
  typeCompte: TypeCompteDetailTotal;
  totalDebit: number;
  totalCredit: number;
  /** Report à-nouveau (écritures de clôture) · l'ouverture, pour un compte de bilan. */
  reportDebit: number;
  reportCredit: number;
  /** Mouvements propres de l'exercice, report à-nouveau exclu. */
  mouvementDebit: number;
  mouvementCredit: number;
  solde: number;
}

/**
 * Un compte correspond à un poste si son numéro commence par l'un des
 * préfixes du poste ET par aucun de ses préfixes exclus (§ convention de
 * lecture, `correspondance-bilan.ts` / `correspondance-projet-bilan.ts`).
 */
export function correspond(numero: string, prefixes: readonly string[], exclusions: readonly string[] = []): boolean {
  return prefixes.some((p) => numero.startsWith(p)) && !exclusions.some((e) => numero.startsWith(e));
}

/**
 * LE REFUS D'UN EXERCICE INCONNU DU DOSSIER (audit final F222) vit dans
 * `common/exercice-introuvable.ts` depuis que la comptabilité et les
 * immobilisations le posent aussi · réexporté ici pour ses lecteurs d'origine.
 */
export { MOTIF_EXERCICE_INTROUVABLE };

/**
 * Exercice « N-1 » d'un bilan/compte de résultat (ou compte d'exploitation) :
 * celui du même tenant dont la date de début est la plus récente PARMI
 * celles antérieures à l'exercice demandé. `null` si aucun (premier
 * exercice du dossier) · le comparatif reste alors simplement absent
 * (`undefined`), jamais un faux zéro qui laisserait croire à un exercice
 * antérieur réel et vide.
 *
 * L'EXERCICE DEMANDÉ DOIT ÊTRE DU DOSSIER, sinon c'est un refus (audit final
 * F222). La balance ne vérifie pas l'exercice qu'on lui passe : un
 * identifiant inconnu, ou celui d'un autre dossier, rendait un bilan tout à
 * zéro, dit équilibré et sans comparatif · une réponse fausse, présentable,
 * là où il fallait un 404. Les états qui cherchent leur comparatif
 * l'appellent avant de lire la balance, c'est donc ici que le refus se pose.
 */
export async function trouverExerciceN1(
  exerciceService: ExerciceService,
  tenantId: string,
  exerciceId: string,
): Promise<string | null> {
  const exercices = await exerciceService.lister(tenantId); // triés par dateDebut décroissant
  const courant = exercices.find((e) => e.id === exerciceId);
  if (!courant) {
    throw new NotFoundException(MOTIF_EXERCICE_INTROUVABLE);
  }
  const anterieur = exercices.find((e) => e.dateDebut < courant.dateDebut);
  return anterieur?.id ?? null;
}

/**
 * L'exercice est-il CLÔTURÉ ? Lu pour dire, sur le bilan d'un exercice clos,
 * le résultat antérieur que sa clôture n'a pas viré au report à nouveau
 * (`resultatAnterieurNonVire`, resultat-de-l-exercice.ts). Un exercice
 * introuvable n'est pas clos · le refus d'un exercice inconnu appartient à
 * `trouverExerciceN1`, que chaque état appelle d'abord.
 */
export async function exerciceCloture(exerciceService: ExerciceService, tenantId: string, exerciceId: string): Promise<boolean> {
  const exercices = (await exerciceService.lister(tenantId)) ?? [];
  return exercices.find((e) => e.id === exerciceId)?.statut === StatutExercice.CLOTURE;
}

/**
 * L'exercice PRÉCÉDENT est-il clôturé ? Lu pour dire, sur la colonne N-1, le
 * résultat antérieur que sa clôture n'a pas viré (`resultatAnterieurNonVireDuComparatif`,
 * paquet 1, A1). Sans exercice précédent, rien n'est clos.
 */
export async function exercicePrecedentCloture(
  exerciceService: ExerciceService,
  tenantId: string,
  exerciceN1Id: string | null,
): Promise<boolean> {
  return exerciceN1Id ? exerciceCloture(exerciceService, tenantId, exerciceN1Id) : false;
}

/**
 * L'EXERCICE PRÉCÉDENT TIENT-IL DES POSITIONS ? (relecture de la passe V1,
 * 2026-10-08) · un exercice précédent OUVERT SANS AUCUNE ÉCRITURE au
 * livre-journal (créé pour y importer plus tard sa balance) ne tient aucune
 * clôture · les positions d'ouverture du tableau des flux se lisent alors sur
 * l'ouverture de l'exercice, comme sans exercice précédent (AUDCIF art. 34 ;
 * SYCEBNL art. 16, 4)), et la mention le dit. Lues sur lui, la trésorerie
 * d'ouverture (ZA) valait zéro sans un mot.
 */
export function exercicePrecedentTenu(exercicePrecedentId: string | null, lignesPrecedent: readonly LigneBalancePourEtat[]): boolean {
  return exercicePrecedentId !== null && lignesPrecedent.length > 0;
}

/** La mention d'un exercice précédent ouvert sans écriture · ouverture lue sur l'exercice, ou nulle. */
export function mentionExercicePrecedentVide(referentiel: 'SYSCOHADA' | 'SYCEBNL', ouvertureLue: boolean): string {
  const article = referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
  return ouvertureLue
    ? `L'exercice précédent est ouvert sans aucune écriture au livre-journal · les positions d'ouverture sont lues sur le bilan d'ouverture de l'exercice (${article}).`
    : `L'exercice précédent est ouvert sans aucune écriture au livre-journal et l'exercice n'a pas de bilan d'ouverture · les positions d'ouverture, trésorerie comprise, sont lues à zéro (${article}). Importez la balance de clôture de l'exercice précédent et clôturez-le, ou passez le bilan d'ouverture en à-nouveau.`;
}

/**
 * LE COMPARATIF D'UN DOSSIER QUI N'A PAS SON EXERCICE N-1 · tranché par la
 * loi le 2026-10-07 (cas chiffrés de la clôture, question Q3, constats B1 et
 * N1).
 *
 * « Le bilan d'ouverture d'un exercice doit correspondre au bilan de clôture
 * de l'exercice précédent » et « chacun des postes des états financiers
 * comporte l'indication du chiffre relatif au poste correspondant de
 * l'exercice précédent » (AUDCIF art. 34, premier et quatrième tirets) ;
 * « Pour chaque poste et rubrique, les chiffres correspondants de l'exercice
 * précédent doivent être mentionnés » (SYCEBNL Partie 4 ch. 1 § 1.4). Le
 * bilan de clôture N-1 EST donc, par la loi, le bilan d'ouverture de N · un
 * dossier repris qui a importé son bilan d'ouverture tient son comparatif de
 * bilan, et ce n'était pas lu (colonne N-1 vide, ZA du tableau des flux à
 * zéro pour un dossier qui ouvrait avec 200 000 en banque).
 *
 * L'ouverture se lit sur la colonne REPORT de la balance du livre-journal
 * (`filtresDesTroisColonnes` · bilan d'ouverture importé ou report validé).
 * L'à-nouveau PROVISOIRE n'y entre jamais · il n'est jamais validé, et il
 * n'existe que derrière un exercice N-1 tenu dans OmegaX, qui sert alors.
 * Sans report du tout, l'ouverture est nulle · c'est la société qui naît.
 *
 * Le COMPTE DE RÉSULTAT N-1 ne se tire pas d'un bilan · sa colonne reste
 * vide, et le motif dit l'issue (`MOTIF_RESULTAT_N1_NON_TENU`).
 */
export type ProvenanceComparatif = 'EXERCICE_N1' | 'BILAN_D_OUVERTURE';

/** Les mêmes lignes ramenées à l'OUVERTURE · le report tient lieu de solde, les mouvements sont mis de côté. */
export function lignesALOuverture<L extends LigneBalancePourEtat>(lignes: readonly L[]): L[] {
  return lignes.map((l) => ({
    ...l,
    totalDebit: l.reportDebit,
    totalCredit: l.reportCredit,
    mouvementDebit: 0,
    mouvementCredit: 0,
    solde: l.reportDebit - l.reportCredit,
  }));
}

/** Le dossier a-t-il un bilan d'ouverture au livre-journal (un report non nul) ? */
export function ouvertureTenue(lignes: readonly LigneBalancePourEtat[]): boolean {
  return lignes.some((l) => Math.abs(l.reportDebit) > 0.005 || Math.abs(l.reportCredit) > 0.005);
}

/**
 * UNE OUVERTURE SAISIE EN OD AU PREMIER JOUR NE SE LIT PAS SANS DOUTE
 * (relecture du 2026-10-07, bloquant 2). Sans exercice précédent ni report,
 * une position de bilan passée au premier jour par le journal d'opérations
 * diverses (le périmètre de la clôture, AU2) peut être la REPRISE d'un
 * dossier (son bilan d'ouverture, art. 34) ou la NAISSANCE de l'entité
 * (l'apport du premier jour), et rien ne les distingue. Lue comme flux, la
 * reprise sortait en acquisitions et en apports et ZA valait zéro, sans un
 * mot ; lue comme ouverture, l'apport disparaîtrait des flux. Elle n'est lue
 * ni l'un ni l'autre · la colonne N-1 n'est pas servie, les postes du tableau
 * des flux qui lisent l'ouverture restent vides, et le motif nomme les
 * pièces et les deux issues.
 */
export interface OuverturePasseeEnOd {
  nombre: number;
  pieces: string[];
}

/** Lue seulement quand elle compte · aucun exercice précédent, aucun report. */
export async function lireOuverturePasseeEnOd(
  ecritureService: EcritureService,
  tenantId: string,
  exerciceId: string,
  exerciceN1Id: string | null,
  lignesN: readonly LigneBalancePourEtat[],
): Promise<OuverturePasseeEnOd | null> {
  if (exerciceN1Id || ouvertureTenue(lignesN)) return null;
  return ecritureService.ouverturePasseeAuPremierJour(tenantId, exerciceId);
}

/** Le motif d'une ouverture saisie en OD, qui n'est lue ni comme flux ni comme ouverture. */
export function motifOuverturePasseeEnOd(o: OuverturePasseeEnOd, referentiel: 'SYSCOHADA' | 'SYCEBNL'): string {
  const article = referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
  const pieces = o.pieces.join(', ') + (o.nombre > o.pieces.length ? ` et ${o.nombre - o.pieces.length} autre(s)` : '');
  return (
    `Le premier jour de l'exercice porte une position de bilan passée en opérations diverses (${pieces}), ` +
    "sans exercice précédent ni à-nouveau dans le dossier · elle peut être le bilan d'ouverture d'un dossier repris " +
    `(${article}) ou l'apport qui fait naître l'entité, et rien ne les distingue. Ni la colonne N-1 ni les postes qui lisent ` +
    "l'ouverture ne sont servis. Si c'est un bilan d'ouverture, passez-le en à-nouveau (import du bilan d'ouverture) ; " +
    "si c'est une opération de l'exercice, passez-la par le journal qui l'encaisse ou datez-la du lendemain."
  );
}

/** L'ouverture présumée nulle d'une entité qui naît · dite, jamais tue. */
export function mentionOuverturePresumeeNulle(referentiel: 'SYSCOHADA' | 'SYCEBNL'): string {
  return referentiel === 'SYCEBNL'
    ? "Aucun exercice précédent ni bilan d'ouverture dans le dossier · l'ouverture est présumée nulle, celle d'une entité qui naît (SYCEBNL art. 16, 4) ; cadre conceptuel § 3.3.1.2.4). Un dossier repris importe son bilan d'ouverture en à-nouveau."
    : "Aucun exercice précédent ni bilan d'ouverture dans le dossier · l'ouverture est présumée nulle, celle d'une entité qui naît (AUDCIF art. 34). Un dossier repris importe son bilan d'ouverture en à-nouveau.";
}

/**
 * Le comparatif d'un BILAN · les lignes de N-1 quand l'exercice existe,
 * sinon celles de l'ouverture de N quand le dossier en a une, sinon rien
 * (premier exercice d'une entité qui naît · aucun exercice précédent, aucune
 * colonne à remplir de zéros). La mention dit toujours d'où vient la colonne
 * ou pourquoi elle manque.
 */
export function comparatifDuBilan(
  exerciceN1Id: string | null,
  lignesN1: LigneBalancePourEtat[],
  lignesN: LigneBalancePourEtat[],
  ouverturePassee: OuverturePasseeEnOd | null,
  referentiel: 'SYSCOHADA' | 'SYCEBNL',
): { provenance: ProvenanceComparatif | null; lignes: LigneBalancePourEtat[]; mention: string | null } {
  if (exerciceN1Id) return { provenance: 'EXERCICE_N1', lignes: lignesN1, mention: null };
  if (ouvertureTenue(lignesN)) {
    return { provenance: 'BILAN_D_OUVERTURE', lignes: lignesALOuverture(lignesN), mention: mentionComparatifSurOuverture(referentiel) };
  }
  if (ouverturePassee) return { provenance: null, lignes: [], mention: motifOuverturePasseeEnOd(ouverturePassee, referentiel) };
  return { provenance: null, lignes: [], mention: mentionOuverturePresumeeNulle(referentiel) };
}

/** La mention imprimée au-dessus d'une colonne N-1 lue sur l'ouverture · un texte par référentiel. */
export function mentionComparatifSurOuverture(referentiel: 'SYSCOHADA' | 'SYCEBNL'): string {
  return referentiel === 'SYCEBNL'
    ? "Colonne N-1 lue sur le bilan d'ouverture du dossier, l'exercice précédent n'étant pas tenu dans OmegaX (SYCEBNL, Partie 4 ch. 1 § 1.4 ; cadre conceptuel § 3.3.1.2.4)."
    : "Colonne N-1 lue sur le bilan d'ouverture du dossier, l'exercice précédent n'étant pas tenu dans OmegaX (AUDCIF art. 34).";
}

/** Le compte de résultat N-1 d'un dossier repris · vide, avec l'issue. */
export const MOTIF_RESULTAT_N1_NON_TENU =
  "Exercice précédent non tenu dans OmegaX : son compte de résultat ne se tire pas du bilan d'ouverture. " +
  "Pour servir le comparatif, ouvrez l'exercice précédent, importez-y sa balance de clôture, puis clôturez-le.";

/**
 * LIGNES DE BALANCE CUMULÉES DEPUIS L'ORIGINE, arrêtées à la fin d'un
 * exercice · voir `EcritureService.balanceCumulee` pour les deux règles de
 * lecture (report à-nouveau exclu, bilan d'ouverture conservé). Même filtre
 * de comptes TOTAL que `chargerLignes`, et pour la même raison.
 */
export async function chargerLignesCumulees(
  ecritureService: EcritureService,
  tenantId: string,
  exerciceId: string | null,
): Promise<LigneBalancePourEtat[]> {
  if (!exerciceId) return [];
  const { lignes } = await ecritureService.balanceCumulee(tenantId, exerciceId, false);
  return lignes.filter((l) => l.typeCompte !== TypeCompteDetailTotal.TOTAL);
}

export async function chargerLignes(
  ecritureService: EcritureService,
  tenantId: string,
  exerciceId: string | null,
  // Situation intermédiaire · ch. 39. Borne la lecture aux écritures dont la
  // date comptable est antérieure ou égale. Absente, l'exercice est lu en
  // entier, comme toujours.
  arreteAu?: Date,
): Promise<LigneBalancePourEtat[]> {
  if (!exerciceId) return [];
  // `false` : les états financiers sont des documents légaux et ne lisent que
  // le livre-journal. Une écriture restée en brouillard n'y est pas encore
  // entrée · un bilan bâti dessus n'engagerait personne (voir
  // EcritureService.balance et StatutEcriture dans le schéma).
  const { lignes } = await ecritureService.balance(tenantId, exerciceId, false, arreteAu);
  // AVANT L'ÉCRITURE QUI SOLDE LES COMPTES DE GESTION · validée depuis F4, elle
  // ramenait à zéro le compte de résultat de tout exercice clos
  // (`avantSoldeDesComptesDeGestion`).
  //
  // GARDE-FOU CONSERVÉ, ET REDONDANT PAR CONSTRUCTION · la balance ne rend
  // plus que des comptes de détail depuis qu'elle a cessé de sous-totaliser
  // par compte principal. Le filtre reste parce qu'un agrégat compté en plus
  // de ses enfants double des montants EN SILENCE · une assurance d'une ligne
  // contre la catégorie de bug que ce projet ne peut pas se permettre.
  return avantSoldeDesComptesDeGestion(lignes).filter((l) => l.typeCompte !== TypeCompteDetailTotal.TOTAL);
}
