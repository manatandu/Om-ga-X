import type { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { StatutEcriture, TypeJournal } from '@prisma/client';
import {
  OPTIONS_CLASSEUR_EN_FLUX,
  attendreLeTuyau,
  poserFeuille,
  segmentIdentification,
  type FeuilleEnFlux,
  type IdentiteEtat,
  type ParametresFeuilleEnFlux,
} from './classeur-en-flux';
import { tirageAKinshasa } from './presentation-fpm';

/**
 * LE JOURNAL EXPORTÉ, PRÉSENTÉ COMME L'ÉDITION DU JOURNAL DE SAGE (décision de
 * Manasse du 2026-10-16, « Comme Sage »). Le classeur portait dix-neuf
 * colonnes sur une seule feuille, tous journaux mêlés · lisible par un
 * filtre, pas par un comptable qui ouvre son livre. Il porte désormais :
 *
 *  · une feuille « Journal », UN BLOC PAR JOURNAL, chacun sous son en-tête
 *    (dossier, journal, période, unité, date et heure du tirage), sept
 *    colonnes (jour, n° pièce, n° compte, n° tiers, libellé, débit, crédit),
 *    les totaux du journal, et un saut de page avant le journal suivant ; la
 *    page imprimée se lit dans l'en-tête d'impression ;
 *  · une feuille « Piste de révision », une ligne par écriture · statut,
 *    saisie, validation et corrections. Elle n'est pas retirée, elle est
 *    rangée à côté · l'AUDCIF art. 22, 1° veut l'origine, le contenu et
 *    l'imputation RESTITUÉS, et le réviseur la lit avec le journal
 *    (CLAUDE.md, § 10 ter).
 *
 * LA DATE DE VALEUR RESTE DANS LE JOURNAL MÊME · « sa date de valeur étant
 * mentionnée distinctement » (AUDCIF art. 22, 4°). Sept colonnes n'en
 * laissent pas une huitième · elle suit le libellé de la ligne, « valeur au
 * jj/mm/aaaa », et a sa colonne dans la piste.
 */

/** Les formats, portés par la COLONNE · en flux, une ligne commise ne se reformate plus. */
const FORMAT_MONTANT = '#,##0.00';
const FORMAT_DATE = 'DD/MM/YYYY';
const FORMAT_DATE_HEURE = 'DD/MM/YYYY HH:mm';

/** Le nombre de colonnes de la feuille « Journal ». */
export const NB_COLONNES_JOURNAL = 7;

/**
 * LE JOUR SE LIT SANS L'ANNÉE quand la période tient en douze mois, comme sur
 * l'édition de Sage · l'en-tête du bloc donne la période, et le 15/01 d'un
 * exercice du 1er juillet au 30 juin n'a qu'une année possible. Au-delà
 * (premier exercice long, AUDCIF art. 7) ou sans borne connue, deux 15/01 se
 * confondraient · l'année s'ajoute. La cellule porte toujours la date
 * entière, seul son affichage change.
 */
export function formatDuJour(periode: { debut: Date; fin: Date } | null): string {
  if (!periode) return 'DD/MM/YY';
  const unAnApres = new Date(periode.debut);
  unAnApres.setUTCFullYear(unAnApres.getUTCFullYear() + 1);
  return periode.fin.getTime() < unAnApres.getTime() ? 'DD/MM' : 'DD/MM/YY';
}

/** Ce que les écritures d'un journal sont, compté avant d'écrire son en-tête. */
export interface StatutsDuBloc {
  validees: number;
  brouillard: number;
  situation: number;
}

/**
 * LE TITRE DU BLOC DIT CE QUE LE BLOC EST · seule l'écriture VALIDÉE est au
 * livre-journal (AUDCIF art. 22, 2°). Un journal entièrement validé est le
 * JOURNAL, un journal entièrement au brouillard est le BROUILLARD, un mélange
 * le dit, et les écritures d'un journal de situation n'y entrent jamais
 * (ligne sage-l1, fonction 12).
 */
export function titreDuBloc(journal: { type: TypeJournal }, statuts: StatutsDuBloc): string {
  if (journal.type === TypeJournal.SITUATION) return 'JOURNAL DE SITUATION · HORS LIVRE-JOURNAL';
  const auBrouillard = statuts.brouillard + statuts.situation;
  if (statuts.validees > 0 && auBrouillard === 0) return 'JOURNAL';
  if (statuts.validees === 0) return 'BROUILLARD';
  return 'JOURNAL ET BROUILLARD';
}

/** Une ligne hors du livre-journal · le brouillard et la situation s'impriment en italique. */
export function estHorsLivreJournal(statut: StatutEcriture | string): boolean {
  return statut !== StatutEcriture.VALIDEE;
}

/** Une date à minuit UTC, en jj/mm/aaaa · la date comptable n'a pas d'heure. */
function jourEnClair(d: Date): string {
  const d2 = (x: number) => String(x).padStart(2, '0');
  return `${d2(d.getUTCDate())}/${d2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/**
 * LE LIBELLÉ D'UNE LIGNE · le sien, sinon celui de l'écriture, et la date de
 * valeur d'une opération reportée au premier jour d'une période ouverte
 * (AUDCIF art. 22, 4°).
 */
export function libelleDeLaLigne(
  ligne: { libelle: string | null },
  ecriture: { libelle: string; dateValeur: Date | null },
): string {
  const propre = ligne.libelle?.trim() ? ligne.libelle.trim() : ecriture.libelle;
  return ecriture.dateValeur ? `${propre} · valeur au ${jourEnClair(ecriture.dateValeur)}` : propre;
}

/**
 * LE N° TIERS D'UNE LIGNE · celui du tiers que le compte de la ligne désigne
 * (`TiersCompte`, un compte pour un tiers). UN COLLECTIF QUI PORTE DES
 * COMPTES INDIVIDUELS N'EN DÉSIGNE AUCUN · il peut rester rattaché au tiers
 * qui l'a reçu le premier (point 13), et une ligne passée au collectif avant
 * l'ouverture des comptes individuels ne se lirait pas comme sienne.
 */
export function tiersDeLaLigne(compte: {
  tiersCompte?: { tiers: { code: string } } | null;
  _count?: { individuels: number };
}): string {
  if (!compte.tiersCompte) return '';
  if ((compte._count?.individuels ?? 0) > 0) return '';
  return compte.tiersCompte.tiers.code;
}

/**
 * LES DEUX SENS DE LA CORRECTION SE NOMMENT DANS LA PISTE · l'erreur et son
 * inscription en négatif RESTENT au journal, « sans blanc ni altération
 * d'aucune sorte » (AUDCIF art. 20, repris par le SYCEBNL Partie 2 ch. 2 ;
 * al. 2 pour le négatif). Une piste qui les tairait laisserait additionner
 * une erreur et sa correction sans savoir laquelle est laquelle.
 */
export function etatDeCorrection(e: {
  correction?: { numeroPiece: number | null } | null;
  corrigeEcriture?: { numeroPiece: number | null } | null;
}): string {
  if (e.correction) return `Annulée par la pièce n° ${e.correction.numeroPiece ?? '·'}`;
  if (e.corrigeEcriture) return `Annule la pièce n° ${e.corrigeEcriture.numeroPiece ?? '·'}`;
  return '';
}

/**
 * LES COLONNES DE LA PISTE DE RÉVISION · une ligne par écriture. La date de
 * saisie n'est pas la date comptable, et l'écart entre les deux est l'axe du
 * test de l'ISA 240 (CLAUDE.md, § 10 ter) · l'heure compte, d'où le format à
 * la minute.
 */
export const COLONNES_PISTE_REVISION: Partial<ExcelJS.Column>[] = [
  { header: 'Journal', key: 'journal', width: 10 },
  { header: 'Date', key: 'date', width: 12, style: { numFmt: FORMAT_DATE } },
  { header: 'Date de valeur', key: 'dateValeur', width: 14, style: { numFmt: FORMAT_DATE } },
  { header: 'N° pièce', key: 'numeroPiece', width: 10 },
  { header: 'Référence', key: 'reference', width: 16 },
  { header: "Libellé de l'écriture", key: 'libelle', width: 36 },
  { header: 'Statut', key: 'statut', width: 12 },
  { header: 'Saisie le', key: 'saisieLe', width: 18, style: { numFmt: FORMAT_DATE_HEURE } },
  { header: 'Saisie par', key: 'saisiePar', width: 28 },
  { header: 'Validée le', key: 'valideeLe', width: 18, style: { numFmt: FORMAT_DATE_HEURE } },
  { header: 'Validée par', key: 'valideePar', width: 28 },
  { header: 'Correction', key: 'correction', width: 30 },
  { header: 'Motif de la correction', key: 'motifCorrection', width: 46 },
];

/** Les titres des sept colonnes du journal, dans leur ordre. */
export const TITRES_COLONNES_JOURNAL = ['Jour', 'N° pièce', 'N° compte', 'N° tiers', 'Libellé', 'Débit', 'Crédit'] as const;

/** Une ligne du journal, telle que l'édition l'imprime. */
export interface LigneDuJournal {
  jour: Date;
  numeroPiece: number | null;
  compte: string;
  tiers: string;
  libelle: string;
  debit: number;
  credit: number;
  horsLivreJournal: boolean;
}

const ARRONDI = (x: number) => Math.round(x * 100) / 100;
const FILET_HAUT: Partial<ExcelJS.Borders> = { top: { style: 'thin' } };
const FILET_BAS: Partial<ExcelJS.Borders> = { bottom: { style: 'thin' } };
const ENTETE_FOND: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

/**
 * Ouvre le classeur du journal, sa première feuille posée. Les blocs
 * s'écrivent dans l'ordre · `ouvrirBloc`, ses lignes, `fermerBloc` · puis
 * `terminer` pose les totaux de la période, ferme la feuille, écrit la piste
 * de révision et ferme l'archive. Un classeur non terminé est un fichier
 * qu'Excel refuse d'ouvrir, et c'est voulu en cas d'échec (voir
 * `classeur-en-flux.ts`).
 */
export function ouvrirJournalEdition(params: {
  sortie: Writable;
  identite: IdentiteEtat;
  formatJour: string;
  /** L'instant du tirage · le même sur chaque en-tête de bloc et au pied. */
  tire?: Date;
}) {
  const { sortie, identite } = params;
  const tire = tirageAKinshasa(params.tire ?? new Date());
  const identification = segmentIdentification(identite);
  const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, ...OPTIONS_CLASSEUR_EN_FLUX });
  classeur.creator = 'OmegaX';
  classeur.created = params.tire ?? new Date();
  const feuille = classeur.addWorksheet('Journal', {
    // Posés À LA CRÉATION · une feuille en flux ne se relit pas. Le journal
    // s'imprime sur la largeur d'une page, comme l'édition de Sage ; la page
    // et son total se lisent à l'en-tête d'impression, que chaque page porte.
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: {
      oddHeader: `&L${identite.entite}&C${identite.periode}&RPage &P / &N`,
      oddFooter:
        `&L${identite.entite}${identification ? ` · ${identification}` : ''} · ` +
        `${identite.periode} · montants en ${identite.devise}&RTiré le ${tire}`,
    },
  });
  feuille.columns = [
    { key: 'jour', width: 9, style: { numFmt: params.formatJour } },
    { key: 'numeroPiece', width: 10 },
    { key: 'compte', width: 12 },
    { key: 'tiers', width: 12 },
    { key: 'libelle', width: 46 },
    { key: 'debit', width: 16, style: { numFmt: FORMAT_MONTANT } },
    { key: 'credit', width: 16, style: { numFmt: FORMAT_MONTANT } },
  ];

  /** Écrit une ligne et attend que le tuyau se vide · rend la ligne commise. */
  const ecrire = async (remplir: (ligne: ExcelJS.Row) => void): Promise<ExcelJS.Row> => {
    const ligne = feuille.addRow([]);
    remplir(ligne);
    ligne.commit();
    await attendreLeTuyau(sortie);
    return ligne;
  };

  // Les lignes des totaux de chaque bloc · la période les additionne, et le
  // saut de page se pose sur la précédente quand un bloc suivant s'ouvre.
  const totauxDesBlocs: ExcelJS.Row[] = [];
  let bloc: { code: string; premiere: number; derniere: number; debit: number; credit: number } | null = null;
  let debitPeriode = 0;
  let creditPeriode = 0;

  const enTete = async (titre: string, journal: string, mention: string | null) => {
    await ecrire((l) => {
      l.getCell(1).value = `${titre} · ${identite.entite}`;
      l.getCell(1).font = { bold: true, size: 12 };
      l.getCell(NB_COLONNES_JOURNAL).value = identite.periode;
      l.getCell(NB_COLONNES_JOURNAL).alignment = { horizontal: 'right' };
    });
    await ecrire((l) => {
      l.getCell(1).value = journal;
      l.getCell(1).font = { bold: true };
      l.getCell(NB_COLONNES_JOURNAL).value = `Tenue de compte : ${identite.devise}`;
      l.getCell(NB_COLONNES_JOURNAL).alignment = { horizontal: 'right' };
    });
    await ecrire((l) => {
      l.getCell(1).value = `Tiré le ${tire}${identification ? ` · ${identification}` : ''}`;
      l.getCell(1).font = { size: 9, italic: true };
    });
    await ecrire((l) => {
      if (mention) {
        l.getCell(1).value = mention;
        l.getCell(1).font = { size: 9, italic: true };
      }
    });
  };

  return {
    feuille,
    classeur,

    /** Ouvre le bloc d'un journal · son en-tête, puis les titres des sept colonnes. */
    async ouvrirBloc(journal: { code: string; intitule: string; type: TypeJournal }, statuts: StatutsDuBloc): Promise<void> {
      if (bloc) throw new Error(`Le bloc du journal ${bloc.code} n'est pas fermé.`);
      // UN JOURNAL PAR PAGE · le saut se pose sous les totaux du précédent.
      const precedent = totauxDesBlocs[totauxDesBlocs.length - 1];
      if (precedent) precedent.addPageBreak();
      const horsLivre = statuts.brouillard + statuts.situation > 0;
      await enTete(
        titreDuBloc(journal, statuts),
        `${journal.code} · ${journal.intitule}`,
        horsLivre ? 'Lignes en italique · hors du livre-journal, non validées.' : null,
      );
      const titres = await ecrire((l) => {
        TITRES_COLONNES_JOURNAL.forEach((t, i) => {
          const c = l.getCell(i + 1);
          c.value = t;
          c.font = { bold: true };
          c.fill = ENTETE_FOND;
          c.border = FILET_BAS;
          if (i >= 5) c.alignment = { horizontal: 'right' };
        });
      });
      bloc = { code: journal.code, premiere: titres.number + 1, derniere: titres.number, debit: 0, credit: 0 };
    },

    /** Écrit une ligne du bloc ouvert. */
    async ajouterLigne(l: LigneDuJournal): Promise<void> {
      if (!bloc) throw new Error("Aucun bloc de journal n'est ouvert.");
      const courant = bloc;
      const ecrite = await ecrire((r) => {
        r.getCell(1).value = l.jour;
        r.getCell(2).value = l.numeroPiece;
        r.getCell(3).value = l.compte;
        r.getCell(4).value = l.tiers || null;
        r.getCell(5).value = l.libelle;
        r.getCell(6).value = l.debit || null;
        r.getCell(7).value = l.credit || null;
        if (l.horsLivreJournal) r.font = { italic: true };
      });
      courant.derniere = ecrite.number;
      courant.debit = ARRONDI(courant.debit + l.debit);
      courant.credit = ARRONDI(courant.credit + l.credit);
    },

    /** Ferme le bloc ouvert sur les totaux du journal · une formule, sa valeur jointe. */
    async fermerBloc(): Promise<void> {
      if (!bloc) throw new Error("Aucun bloc de journal n'est ouvert.");
      const courant = bloc;
      const total = await ecrire((r) => {
        r.getCell(5).value = `Totaux du journal ${courant.code}`;
        for (const [rang, valeur] of [
          [6, courant.debit],
          [7, courant.credit],
        ] as const) {
          const lettre = rang === 6 ? 'F' : 'G';
          r.getCell(rang).value =
            courant.derniere >= courant.premiere
              ? { formula: `SUM(${lettre}${courant.premiere}:${lettre}${courant.derniere})`, result: valeur }
              : 0;
        }
        r.font = { bold: true };
        for (let c = 1; c <= NB_COLONNES_JOURNAL; c++) r.getCell(c).border = FILET_HAUT;
      });
      totauxDesBlocs.push(total);
      debitPeriode = ARRONDI(debitPeriode + courant.debit);
      creditPeriode = ARRONDI(creditPeriode + courant.credit);
      bloc = null;
    },

    /**
     * Un dossier sans écriture sur la période rend un journal vide qui le DIT ·
     * un fichier sans en-tête se lirait comme un export échoué.
     */
    async aucuneEcriture(): Promise<void> {
      await enTete('JOURNAL', 'Tous journaux', null);
      await ecrire((l) => {
        l.getCell(1).value = 'Aucune écriture sur la période.';
        l.getCell(1).font = { italic: true };
      });
    },

    /**
     * Pose les totaux de la période, ferme la feuille, écrit les suivantes
     * (la piste de révision) et ferme l'archive. Les totaux de la période
     * additionnent les totaux des journaux · une formule sur toute la
     * colonne compterait chaque montant deux fois.
     */
    async terminer(
      suivantes?: (ajouterFeuille: (p: ParametresFeuilleEnFlux) => FeuilleEnFlux) => Promise<void>,
    ): Promise<void> {
      if (bloc) throw new Error(`Le bloc du journal ${bloc.code} n'est pas fermé.`);
      await ecrire(() => undefined);
      await ecrire((r) => {
        r.getCell(5).value = 'Totaux de la période';
        for (const [rang, valeur] of [
          [6, debitPeriode],
          [7, creditPeriode],
        ] as const) {
          const lettre = rang === 6 ? 'F' : 'G';
          r.getCell(rang).value =
            totauxDesBlocs.length > 0
              ? { formula: totauxDesBlocs.map((t) => `${lettre}${t.number}`).join('+'), result: valeur }
              : 0;
        }
        r.font = { bold: true };
        for (let c = 1; c <= NB_COLONNES_JOURNAL; c++) r.getCell(c).border = { top: { style: 'double' } };
      });
      feuille.commit();
      if (suivantes) await suivantes((p) => poserFeuille(classeur, sortie, p));
      await classeur.commit();
    },

    /** Les totaux de la période, tels qu'ils seront écrits. */
    totauxPeriode: () => ({ debit: debitPeriode, credit: creditPeriode }),
  };
}
