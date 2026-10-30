import { createHash } from 'crypto';
import { EtatEcritureRecue } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { verifierClasseurBorne } from '../../../common/borne-classeur';
import { lireDate, lireMontant } from '../../import/lecture-fichier';
import {
  COLONNES_ECHANGE,
  COLONNES_SUPPRIMEES,
  FEUILLE_ECRITURES,
  FEUILLE_EXPORT,
  FEUILLE_SUPPRIMEES,
} from '../modifications/export-modifications';

/**
 * L'ÉCHANGE D'ÉCRITURES ENTRE DOSSIERS OMEGAX (ligne dossier-l9, fonction 102 ·
 * Sage, « écritures échangées avec l'expert-comptable, journaux
 * synchronisés »). Le dossier qui reçoit relit l'EXPORT DES SEULES
 * MODIFICATIONS d'un autre dossier (ligne sage-l7, fonction 99), qui porte, par
 * écriture, son identifiant d'origine et son mouvement (nouvelle, modifiée
 * depuis son envoi, déjà envoyée), et nomme sur une feuille à part les
 * écritures retirées depuis leur envoi. Les règles pures, sans base · le
 * service les joue.
 *
 * DÉCISIONS PAR LA LOI.
 *
 *  · CE QUI ENTRE PAR TRANSMISSION S'APPUIE SUR UNE PIÈCE PROBANTE · AUDCIF
 *    art. 22, 7°, « chaque donnée entrée par transmission d'un autre système
 *    doit être appuyée d'une pièce justificative probante ». La pièce est
 *    l'envoi lui-même, numéroté et daté chez l'expéditeur · la réception le
 *    cite par son dossier, son numéro et l'EMPREINTE de son fichier, gardés
 *    ici ; le même fichier ne se relit pas deux fois.
 *
 *  · RIEN N'ENTRE AU LIVRE-JOURNAL SANS LE DOSSIER QUI REÇOIT · art. 22, 2° ·
 *    la validation fait entrer la pièce au livre-journal et la rend
 *    irréversible. Une écriture reçue naît AU BROUILLARD, quel que soit son
 *    statut chez l'expéditeur, et c'est le dossier qui reçoit qui la valide.
 *
 *  · CE QUI EST VALIDÉ ICI NE SE RETOUCHE PLUS · art. 22, 2°, et art. 20,
 *    al. 2 · une écriture reçue que le dossier a validée ne se remplace ni ne
 *    se retire par un envoi suivant · le refus le dit, et la correction passe
 *    par une inscription en négatif, au dossier de la faire.
 *
 *  · JAMAIS DEUX FOIS LA MÊME · le registre tient chaque écriture reçue par
 *    son IDENTIFIANT d'origine · une écriture déjà reçue n'est jamais recréée,
 *    qu'elle arrive « Nouvelle » d'un second fichier ou « Déjà envoyée ».
 *    Elle est REMPLACÉE au brouillard quand son contenu a changé, jamais par
 *    un envoi plus ancien que celui qui l'a portée en dernier.
 *
 *  · CHAQUE ÉCRITURE EST JUGÉE COMME L'IMPORT DES ÉCRITURES LA JUGE ·
 *    compte et journal du dossier, compte de détail, pièce équilibrée, les
 *    contrôles d'entrée de la saisie (`EcritureService.controlesDEntree`),
 *    ventilation analytique non exigée (le fichier n'en porte pas) · une
 *    écriture refusée l'est nommément, sans emporter les autres.
 *
 * Hors du champ, et dit · l'analytique, les pièces jointes, le lettrage et le
 * pointage ne voyagent pas (le fichier ne les porte pas) ; une écriture reçue
 * ne repart pas par l'export des modifications du dossier qui la reçoit (elle
 * appartient à l'expéditeur, et y revenir la créerait une seconde fois chez
 * lui).
 */

/** Une ligne d'écriture lue dans l'envoi. */
export interface LigneRecue {
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
  devise: string;
  montantDevise: string;
  cours: string;
  echeance: Date | null;
}

/** Une écriture lue dans l'envoi, rassemblée par son identifiant d'origine. */
export interface EcritureLueDansLEnvoi {
  identifiant: string;
  date: Date;
  journal: string;
  piece: string;
  reference: string | null;
  statut: string;
  mouvement: string;
  lignes: LigneRecue[];
  /** Le rang de sa première ligne dans la feuille, pour la nommer. */
  rang: number;
}

/** Une écriture que l'expéditeur dit retirée depuis son envoi. */
export interface SuppressionLueDansLEnvoi {
  identifiant: string;
  date: Date | null;
  journal: string;
  piece: string;
  libelle: string;
}

/** Ce qu'un envoi porte, lu et vérifié. */
export interface EnvoiLu {
  dossierSource: string;
  numeroExport: number;
  ecritures: EcritureLueDansLEnvoi[];
  suppressions: SuppressionLueDansLEnvoi[];
  /** Ce qui, dans la feuille, ne se lit pas · nommé, jamais tu. */
  illisibles: Array<{ rang: number; message: string }>;
}

/** Le refus d'un fichier qui n'est pas un envoi d'OmegaX · le fichier entier, avant toute écriture. */
export class EnvoiIllisible extends Error {}

const enTexte = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    return '';
  }
  return String(v);
};

/** Les en-têtes d'une feuille, colonne par colonne (1-indexé comme ExcelJS). */
function entetes(feuille: ExcelJS.Worksheet): Map<string, number> {
  const ligne = feuille.getRow(1);
  const carte = new Map<string, number>();
  ligne.eachCell((cellule, colonne) => carte.set(enTexte(cellule.value).trim(), colonne));
  return carte;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * LIT UN ENVOI · les trois feuilles de l'export des modifications, par leurs
 * en-têtes (jamais par leur position). Un fichier qui n'en a pas la forme est
 * refusé entier (`EnvoiIllisible`) · le lire à moitié créerait des écritures
 * sans identifiant, que le registre ne saurait plus reconnaître.
 */
export async function lireEnvoi(contenu: Buffer): Promise<EnvoiLu> {
  verifierClasseurBorne(contenu);
  const classeur = new ExcelJS.Workbook();
  try {
    await classeur.xlsx.load(contenu as unknown as ArrayBuffer);
  } catch {
    throw new EnvoiIllisible("Le fichier n'est pas un classeur Excel lisible · seul l'export des modifications d'un dossier OmegaX se relit ici.");
  }
  const feuille = classeur.getWorksheet(FEUILLE_ECRITURES);
  const recap = classeur.getWorksheet(FEUILLE_EXPORT);
  if (!feuille || !recap) {
    throw new EnvoiIllisible(
      `Ce classeur n'est pas un export des modifications d'OmegaX · les feuilles « ${FEUILLE_ECRITURES} » et « ${FEUILLE_EXPORT} » ` +
        "sont attendues (Fichier > Exporter les modifications, dans le dossier qui envoie). Un autre fichier passe par Fichier > Importer des données.",
    );
  }

  // FEUILLE « Export » · le dossier et le numéro de l'envoi.
  const rubriques = new Map<string, string>();
  recap.eachRow((ligne, rang) => {
    if (rang === 1) return;
    rubriques.set(enTexte(ligne.getCell(1).value).trim(), enTexte(ligne.getCell(2).value).trim());
  });
  const dossierSource = rubriques.get('Dossier') ?? '';
  const numeroExport = Number(rubriques.get('Export n°'));
  if (!dossierSource || !Number.isInteger(numeroExport) || numeroExport < 1) {
    throw new EnvoiIllisible("La feuille « Export » ne dit ni le dossier ni le numéro de l'envoi · ce fichier ne se relit pas comme un échange.");
  }

  // FEUILLE « Écritures » · une ligne par ligne d'écriture, l'identifiant d'origine en colonne.
  const colonnes = entetes(feuille);
  const col = (cle: (typeof COLONNES_ECHANGE)[number]['key']) => colonnes.get(COLONNES_ECHANGE.find((c) => c.key === cle)!.header);
  const requises = ['date', 'journal', 'piece', 'compte', 'libelle', 'debit', 'credit', 'statut', 'mouvement', 'identifiant'] as const;
  const manquantes = requises.filter((c) => col(c) === undefined).map((c) => COLONNES_ECHANGE.find((x) => x.key === c)!.header);
  if (manquantes.length > 0) {
    throw new EnvoiIllisible(`La feuille « ${FEUILLE_ECRITURES} » n'a pas les colonnes de l'export des modifications · manquent ${manquantes.map((m) => `« ${m} »`).join(', ')}.`);
  }
  const texte = (ligne: ExcelJS.Row, cle: (typeof COLONNES_ECHANGE)[number]['key']) => {
    const i = col(cle);
    return i === undefined ? '' : enTexte(ligne.getCell(i).value).trim();
  };

  const parIdentifiant = new Map<string, EcritureLueDansLEnvoi>();
  const illisibles: Array<{ rang: number; message: string }> = [];
  const ecarte = new Set<string>();
  feuille.eachRow((ligne, rang) => {
    if (rang === 1) return;
    const identifiant = texte(ligne, 'identifiant');
    const compte = texte(ligne, 'compte').replace(/\s/g, '');
    if (!identifiant && !compte) return;
    if (!UUID.test(identifiant)) {
      illisibles.push({ rang, message: `Identifiant d'origine absent ou illisible (« ${identifiant} ») · la ligne n'est pas lue.` });
      return;
    }
    if (ecarte.has(identifiant)) return;
    const date = lireDate(texte(ligne, 'date'));
    const debit = lireMontant(texte(ligne, 'debit'));
    const credit = lireMontant(texte(ligne, 'credit'));
    if (!date || debit === null || credit === null || !compte) {
      illisibles.push({ rang, message: `Date, compte ou montant illisible · l'écriture ${identifiant.slice(0, 8)} n'est pas lue.` });
      ecarte.add(identifiant);
      parIdentifiant.delete(identifiant);
      return;
    }
    const tete = {
      date,
      journal: texte(ligne, 'journal').toUpperCase(),
      piece: texte(ligne, 'piece'),
      reference: texte(ligne, 'reference') || null,
      statut: texte(ligne, 'statut'),
      mouvement: texte(ligne, 'mouvement'),
    };
    const echeance = lireDate(texte(ligne, 'echeance'));
    const l: LigneRecue = {
      compte,
      libelle: texte(ligne, 'libelle'),
      debit,
      credit,
      devise: texte(ligne, 'devise'),
      montantDevise: texte(ligne, 'montantDevise'),
      cours: texte(ligne, 'cours'),
      echeance,
    };
    const deja = parIdentifiant.get(identifiant);
    if (!deja) {
      parIdentifiant.set(identifiant, { identifiant, ...tete, lignes: [l], rang });
      return;
    }
    // Les lignes d'une écriture portent la même tête · une écriture dont deux
    // lignes ne s'accordent pas n'est pas lue, plutôt que de prendre l'une au hasard.
    if (
      deja.date.getTime() !== tete.date.getTime() ||
      deja.journal !== tete.journal ||
      deja.piece !== tete.piece ||
      deja.reference !== tete.reference ||
      deja.mouvement !== tete.mouvement
    ) {
      illisibles.push({ rang, message: `Les lignes de l'écriture ${identifiant.slice(0, 8)} ne portent pas la même date, le même journal ou la même pièce · elle n'est pas lue.` });
      ecarte.add(identifiant);
      parIdentifiant.delete(identifiant);
      return;
    }
    deja.lignes.push(l);
  });

  // FEUILLE « Supprimées » · facultative (un premier export n'en a aucune à dire).
  const suppressions: SuppressionLueDansLEnvoi[] = [];
  const feuilleSupprimees = classeur.getWorksheet(FEUILLE_SUPPRIMEES);
  if (feuilleSupprimees) {
    const cs = entetes(feuilleSupprimees);
    const c = (cle: (typeof COLONNES_SUPPRIMEES)[number]['key']) => cs.get(COLONNES_SUPPRIMEES.find((x) => x.key === cle)!.header);
    const lire = (ligne: ExcelJS.Row, cle: (typeof COLONNES_SUPPRIMEES)[number]['key']) => {
      const i = c(cle);
      return i === undefined ? '' : enTexte(ligne.getCell(i).value).trim();
    };
    feuilleSupprimees.eachRow((ligne, rang) => {
      if (rang === 1) return;
      const identifiant = lire(ligne, 'identifiant');
      if (!identifiant) return;
      if (!UUID.test(identifiant)) {
        illisibles.push({ rang, message: `Feuille « ${FEUILLE_SUPPRIMEES} » · identifiant illisible (« ${identifiant} »), la suppression n'est pas lue.` });
        return;
      }
      suppressions.push({
        identifiant,
        date: lireDate(lire(ligne, 'date')),
        journal: lire(ligne, 'journal'),
        piece: lire(ligne, 'piece'),
        libelle: lire(ligne, 'libelle'),
      });
    });
  }
  return { dossierSource, numeroExport, ecritures: [...parIdentifiant.values()], suppressions, illisibles };
}

/**
 * L'EMPREINTE DU CONTENU REÇU · ce qui fait qu'une écriture a changé chez
 * l'expéditeur. Ni le statut (une écriture validée chez lui naît ici au
 * brouillard, et sa validation n'y change rien), ni le numéro de pièce (celui
 * du dossier qui reçoit est le sien), ni le mouvement · la date, le journal,
 * la référence, et les lignes dans un ordre total sur leur contenu, montants
 * au centime en texte.
 */
export function empreinteRecue(e: Pick<EcritureLueDansLEnvoi, 'date' | 'journal' | 'reference' | 'lignes'>): string {
  const lignes = e.lignes
    .map((l) =>
      JSON.stringify([
        l.compte,
        l.libelle,
        l.debit.toFixed(2),
        l.credit.toFixed(2),
        l.devise.toUpperCase(),
        l.montantDevise,
        l.cours,
        l.echeance ? l.echeance.toISOString().slice(0, 10) : null,
      ]),
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const contenu = { date: e.date.toISOString().slice(0, 10), journal: e.journal, reference: e.reference ?? null, lignes };
  return createHash('sha256').update(JSON.stringify(contenu)).digest('hex');
}

/** L'empreinte du fichier reçu · celle que l'expéditeur garde au registre de ses exports. */
export function empreinteDuFichier(contenu: Buffer): string {
  return createHash('sha256').update(contenu).digest('hex');
}

/** Ce que le registre sait d'une écriture déjà reçue. */
export interface EntreeRecue {
  etat: EtatEcritureRecue;
  ecritureId: string | null;
  empreinteSource: string;
  numeroExportSource: number;
}

export type Decision =
  | { action: 'CREER'; note: string | null }
  | { action: 'REMPLACER' }
  | { action: 'LAISSER'; motif: string; refus: boolean };

/**
 * CE QUE LA RÉCEPTION FAIT D'UNE ÉCRITURE DE L'ENVOI, au regard du registre ·
 * la seule table de décision, que le service et son aperçu jouent.
 */
export function decisionPour(entree: EntreeRecue | undefined, empreinte: string, numeroExport: number, mouvement: string): Decision {
  if (!entree) {
    // Jamais reçue · elle naît, quel que soit le mouvement. « Modifiée » ou
    // « Déjà envoyée » disent que l'envoi qui la portait n'a pas été relu ici.
    return {
      action: 'CREER',
      note: mouvement.startsWith('Nouvelle') || mouvement === '' ? null : `jamais reçue jusqu'ici (« ${mouvement} ») · créée`,
    };
  }
  if (entree.etat === EtatEcritureRecue.DETACHEE) {
    return entree.empreinteSource === empreinte
      ? { action: 'LAISSER', motif: 'déjà reçue, détachée depuis · inchangée chez l’expéditeur', refus: false }
      : {
          action: 'LAISSER',
          motif: "détachée de l'échange dans ce dossier · la modification de l'expéditeur n'y est pas portée, à reprendre à la main si elle vaut",
          refus: true,
        };
  }
  if (entree.etat === EtatEcritureRecue.RETIREE_PAR_LA_SOURCE) {
    return {
      action: 'LAISSER',
      motif: `retirée par l'expéditeur à un envoi précédent · elle n'est pas recréée`,
      refus: true,
    };
  }
  // TENUE.
  if (numeroExport <= entree.numeroExportSource) {
    return {
      action: 'LAISSER',
      motif: `déjà reçue par l'envoi n° ${entree.numeroExportSource}, plus récent que celui-ci · rien n'est changé`,
      refus: false,
    };
  }
  if (entree.ecritureId === null) return { action: 'CREER', note: 'son remplacement avait été interrompu · recréée' };
  if (entree.empreinteSource === empreinte) return { action: 'LAISSER', motif: 'déjà reçue à l’identique', refus: false };
  return { action: 'REMPLACER' };
}

/** Le nom d'une écriture de l'envoi dans le compte rendu · son journal, sa pièce et sa date chez l'expéditeur. */
export function nomDeLaPiece(e: { journal: string; piece: string; date: Date | null }): string {
  const jour = e.date ? e.date.toISOString().slice(0, 10).split('-').reverse().join('/') : 'date inconnue';
  return `${e.journal || '?'} n° ${e.piece || '?'} du ${jour}`;
}

/** Le compte rendu d'une réception est borné · au-delà, le total le dit. */
export const PLAFOND_COMPTE_RENDU = 200;

/**
 * UNE RÉCEPTION INTERROMPUE SE REPREND · une réception EN_COURS depuis plus
 * longtemps que ce délai est tenue pour tombée (processus arrêté), et le même
 * fichier se relit · ce qui avait été reçu n'est jamais recréé. En deçà, elle
 * est en cours sur un autre poste, et le second geste est refusé.
 */
export const DELAI_RECEPTION_TOMBEE_MS = 30 * 60 * 1000;
