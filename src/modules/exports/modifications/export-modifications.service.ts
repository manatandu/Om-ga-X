import { BadRequestException, ConflictException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ModeExportEcritures, Prisma, StatutEcriture } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../common/prisma.service';
import { transactionJournalisee } from '../../../common/audit/transaction-journalisee';
import { LOT_LECTURE, apresLaCle, idApres } from '../../../common/lecture-par-lots';
import { HORS_SITUATION, filtreDuStatut, libelleDuStatut } from '../../comptabilite/ecritures-de-situation';
import { ExportService } from '../export.service';
import { LOT_EXPORT, MAX_LIGNES_EXPORT, attendreLeTuyau, segmentIdentification } from '../classeur-en-flux';
import { produireEnMemoire } from '../fichier-en-memoire';
import { pageDeNumeros } from '../pagination-par-numero';
import {
  COLONNES_ECHANGE,
  COLONNES_SUPPRIMEES,
  type EcritureEchange,
  type EntreeRegistre,
  FEUILLE_ECRITURES,
  FEUILLE_EXPORT,
  FEUILLE_SUPPRIMEES,
  MENTION_RELECTURE,
  type Mouvement,
  PiecesDistinctes,
  empreinteEcriture,
  empreinteFichier,
  libelleMouvement,
  motifExportVide,
  motifHorsPlafond,
  mouvementDe,
  nomFichierExport,
  ordonnerLignes,
} from './export-modifications';

/** Au-delà, la liste des exports se tronque et le dit (CLAUDE.md § 8 bis). */
export const PLAFOND_EXPORTS_LISTES = 50;

/** Tranches d'écriture du registre dans la transaction · loin sous le plafond de paramètres de PostgreSQL. */
const TRANCHE_REGISTRE = 2000;

/** Délai de la transaction qui range l'export · elle écrit le registre de tout un lot, comme l'import. */
const DELAI_RANGEMENT_MS = 120_000;

/** Une écriture que l'export portera, et ce que le registre savait d'elle. */
interface Candidat {
  id: string;
  date: Date;
  lignes: number;
  entree?: EntreeRegistre;
  mouvement: Mouvement;
}

/** Une ligne du registre, telle que la feuille « Supprimées » la nomme. */
interface EntreeSupprimee {
  ecritureId: string;
  numeroExport: number;
  date: Date;
  journalCode: string;
  piece: string;
  libelle: string;
}

/** Ce que le prochain export porterait · lu sans rien écrire. */
export interface InventaireExport {
  dernierNumero: number | null;
  retenues: Candidat[];
  supprimees: EntreeSupprimee[];
  lignes: number;
  nouvelles: number;
  modifiees: number;
  renvoyees: number;
  enAttente: number;
  /** La première pièce qu'aucun export ne peut porter (plus de lignes que le plafond) · elle refuse l'export. */
  horsPlafond: Candidat | null;
  /** Parties au brouillard, modifiées depuis, et hors de cette portée (brouillard non compris). */
  brouillardModifieHorsPortee: number;
}

/** Le contenu d'une écriture lu en base, le seul qui part dans le fichier. */
const CONTENU_ECRITURE = {
  journal: { select: { code: true } },
  lignes: {
    select: {
      libelle: true,
      debit: true,
      credit: true,
      montantDevise: true,
      coursApplique: true,
      dateEcheance: true,
      compte: { select: { numero: true } },
      devise: { select: { code: true } },
    },
  },
} satisfies Prisma.EcritureInclude;

type EcritureLue = Prisma.EcritureGetPayload<{ include: typeof CONTENU_ECRITURE }>;

/** Une écriture lue, rendue dans la forme du fichier · une seule écriture de la conversion. */
export function versEchange(e: EcritureLue): EcritureEchange {
  const texte = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed(2));
  return {
    id: e.id,
    date: e.date,
    dateValeur: e.dateValeur,
    journal: e.journal.code,
    numeroPiece: e.numeroPiece,
    reference: e.reference,
    libelle: e.libelle,
    statut: e.statut,
    lignes: e.lignes.map((l) => ({
      compte: l.compte.numero,
      libelle: l.libelle,
      debit: l.debit.toFixed(2),
      credit: l.credit.toFixed(2),
      devise: l.devise?.code ?? null,
      montantDevise: texte(l.montantDevise),
      // Le cours garde sa précision (six décimales en base) · ce n'est pas un montant.
      cours: l.coursApplique === null ? null : l.coursApplique.toString(),
      echeance: l.dateEcheance ? l.dateEcheance.toISOString().slice(0, 10) : null,
    })),
  };
}

/**
 * L'EXPORT DES SEULES MODIFICATIONS (ligne sage-l7, fonction 99) · décisions
 * et règles dans `export-modifications.ts`.
 *
 * DEUX TEMPS, ET LE SECOND SEUL ÉCRIT. (1) L'inventaire lit le registre et
 * les écritures par tranches, sans rien écrire (l'aperçu s'arrête là). (2)
 * L'export produit le fichier EN MÉMOIRE, puis, dans UNE transaction courte,
 * prend son numéro, range le fichier et met le registre à jour. Si un autre
 * export a pris un numéro entre-temps, le second est refusé (409) · le
 * fichier qu'il avait écrit portait un numéro et des « remplace l'envoi n° k »
 * lus sur un registre qui n'est plus le bon. Aucun verrou n'est tenu pendant
 * la lecture (un verrou consultatif dans une transaction longue figeait le
 * pool de tous les cabinets, CLAUDE.md § 6).
 */
@Injectable()
export class ExportModificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
  ) {}

  /** Les exports du dossier, les plus récents d'abord, l'auteur en courriel, sans le fichier. */
  async lister(tenantId: string, avant?: number) {
    // JAMAIS `exports` comme nom de variable · compilé en CommonJS, la
    // constante du module (`PLAFOND_EXPORTS_LISTES`) se lit `exports.…`, et une
    // variable locale de ce nom la masquait (« Cannot access 'exports' before
    // initialization », 500 au premier serveur réel, vert sous les tests).
    const [lusEtSurplus, total] = await Promise.all([
      this.prisma.exportEcritures.findMany({
        where: { tenantId, ...(avant !== undefined ? { numero: { lt: avant } } : {}) },
        orderBy: { numero: 'desc' },
        // Un de plus que la page · il dit qu'il en reste de plus anciens, à
        // retélécharger par la page suivante (relecture m5).
        take: PLAFOND_EXPORTS_LISTES + 1,
        select: {
          id: true,
          numero: true,
          mode: true,
          inclureBrouillard: true,
          produitAt: true,
          produitPar: true,
          nombreEcritures: true,
          nombreNouvelles: true,
          nombreModifiees: true,
          nombreSupprimees: true,
          nombreLignes: true,
          nombreEnAttente: true,
          nomFichier: true,
          taille: true,
          empreinte: true,
        },
      }),
      this.prisma.exportEcritures.count({ where: { tenantId } }),
    ]);
    const { page: lus, plusAnciensAvant } = pageDeNumeros(lusEtSurplus, PLAFOND_EXPORTS_LISTES);
    const courriels = await this.courriels(tenantId, lus.map((e) => e.produitPar));
    return {
      exports: lus.map((e) => ({ ...e, produitPar: courriels(e.produitPar) })),
      total,
      tronque: total > lus.length,
      plusAnciensAvant,
    };
  }

  /** Ce que le prochain export des modifications porterait · rien n'est écrit, aucun numéro n'est pris. */
  async apercu(tenantId: string, inclureBrouillard: boolean) {
    const inv = await this.inventaire(tenantId, ModeExportEcritures.MODIFICATIONS, inclureBrouillard);
    return {
      dernierNumero: inv.dernierNumero,
      nouvelles: inv.nouvelles,
      modifiees: inv.modifiees,
      supprimees: inv.supprimees.length,
      lignes: inv.lignes,
      enAttente: inv.enAttente,
      plafondLignes: MAX_LIGNES_EXPORT,
      brouillardModifieHorsPortee: inv.brouillardModifieHorsPortee,
      // Le refus que l'export opposerait, dit dès l'aperçu (relecture m3).
      horsPlafond: inv.horsPlafond ? await this.motifDuHorsPlafond(tenantId, inv.horsPlafond) : null,
    };
  }

  /** Le refus nommé d'une pièce qu'aucun export ne peut porter · journal, numéro, date, lignes, plafond. */
  private async motifDuHorsPlafond(tenantId: string, c: Candidat): Promise<string> {
    const e = await this.prisma.ecriture.findFirst({
      where: { id: c.id, tenantId, ...HORS_SITUATION },
      select: { numeroPiece: true, date: true, journal: { select: { code: true } } },
    });
    return motifHorsPlafond(
      { journal: e?.journal.code ?? '?', numeroPiece: e?.numeroPiece ?? null, date: e?.date ?? c.date, lignes: c.lignes },
      MAX_LIGNES_EXPORT,
    );
  }

  /**
   * L'INVENTAIRE · registre d'abord (ce qui est parti · supprimé, modifié, ou
   * à renvoyer tel quel par un export complet), écritures ensuite (ce qui
   * n'est jamais parti), dans l'ordre des dates, jusqu'au plafond de lignes.
   * Les modifications et les suppressions passent avant les nouvelles · elles
   * corrigent ce que la receveuse tient déjà.
   */
  async inventaire(tenantId: string, mode: ModeExportEcritures, inclureBrouillard: boolean): Promise<InventaireExport> {
    const dernier = await this.prisma.exportEcritures.aggregate({ where: { tenantId }, _max: { numero: true } });
    const dernierNumero = dernier._max.numero ?? null;
    const complet = mode === ModeExportEcritures.COMPLET;
    const dejaParties: Candidat[] = [];
    const supprimees: EntreeSupprimee[] = [];
    let brouillardModifieHorsPortee = 0;

    // (1) LE REGISTRE, par tranches, PAR LA CLÉ (`idApres`) · un export rangé
    // pendant cette lecture remplace des entrées (retirées puis recréées), et
    // le curseur de Prisma posé sur une entrée retirée rendait une tranche
    // vide, l'inventaire s'arrêtant sans un mot (relecture M6).
    let curseur: string | undefined;
    for (;;) {
      const lot = await this.prisma.ecritureExportee.findMany({
        where: { tenantId, supprimeeAuNumero: null, ...idApres(curseur) },
        select: {
          id: true,
          ecritureId: true,
          numeroExport: true,
          statutExporte: true,
          empreinte: true,
          date: true,
          journalCode: true,
          piece: true,
          libelle: true,
        },
        orderBy: { id: 'asc' },
        take: LOT_LECTURE,
      });
      if (lot.length === 0) break;
      const presentes = await this.prisma.ecriture.findMany({
        where: { tenantId, id: { in: lot.map((r) => r.ecritureId) }, estANouveauProvisoire: false, ...HORS_SITUATION },
        select: { id: true, statut: true },
      });
      const statutPresent = new Map(presentes.map((e) => [e.id, e.statut]));
      // Ce qui se relit · une écriture partie au brouillard, toujours (elle a pu
      // changer, ou être validée) ; une partie validée, seulement quand
      // l'export complet la renvoie (art. 22, 2° · elle ne change plus).
      const aRelire: string[] = [];
      // Hors de la portée (brouillard non compris), une pièce partie au
      // brouillard n'est ni portée ni redite · mais si elle a CHANGÉ depuis son
      // envoi, la receveuse tient une version périmée, et le nombre se dit à
      // l'aperçu et au récapitulatif (relecture m8).
      const horsPortee: string[] = [];
      for (const r of lot) {
        const statut = statutPresent.get(r.ecritureId);
        if (statut === undefined) {
          supprimees.push({
            ecritureId: r.ecritureId,
            numeroExport: r.numeroExport,
            date: r.date,
            journalCode: r.journalCode,
            piece: r.piece,
            libelle: r.libelle,
          });
          continue;
        }
        if (!inclureBrouillard && statut === StatutEcriture.BROUILLARD) {
          horsPortee.push(r.ecritureId);
          continue;
        }
        if (complet || r.statutExporte === StatutEcriture.BROUILLARD) aRelire.push(r.ecritureId);
      }
      const parId = new Map(lot.map((r) => [r.ecritureId, r]));
      const entreeDe = (id: string): EntreeRegistre => {
        const r = parId.get(id)!;
        return { numeroExport: r.numeroExport, statutExporte: r.statutExporte, empreinte: r.empreinte };
      };
      for (let i = 0; i < aRelire.length; i += LOT_EXPORT) {
        for (const e of await this.contenus(tenantId, aRelire.slice(i, i + LOT_EXPORT))) {
          const entree = entreeDe(e.id);
          const mouvement = mouvementDe(entree, empreinteEcriture(versEchange(e)));
          if (mouvement === 'RENVOYEE' && !complet) continue;
          dejaParties.push({ id: e.id, date: e.date, lignes: e.lignes.length, entree, mouvement });
        }
      }
      for (let i = 0; i < horsPortee.length; i += LOT_EXPORT) {
        for (const e of await this.contenus(tenantId, horsPortee.slice(i, i + LOT_EXPORT))) {
          if (mouvementDe(entreeDe(e.id), empreinteEcriture(versEchange(e))) === 'MODIFIEE') brouillardModifieHorsPortee++;
        }
      }
      if (lot.length < LOT_LECTURE) break;
      curseur = lot[lot.length - 1].id;
    }

    // Le budget de lignes · modifications (et renvois de l'export complet) d'abord.
    dejaParties.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    const retenues: Candidat[] = [];
    let lignes = 0;
    let enAttente = 0;
    let horsPlafond: Candidat | null = null;
    for (const c of dejaParties) {
      // Une pièce qu'aucun export ne peut porter n'« attend » pas · elle est
      // nommée, et l'export refusé (relecture m3).
      if (c.lignes > MAX_LIGNES_EXPORT) {
        horsPlafond ??= c;
        continue;
      }
      if (lignes + c.lignes > MAX_LIGNES_EXPORT) {
        enAttente++;
        continue;
      }
      retenues.push(c);
      lignes += c.lignes;
    }

    // (2) LES ÉCRITURES JAMAIS PARTIES, dans l'ordre des dates, par tranches
    // et PAR LA CLÉ (date, identifiant · `apresLaCle`, relecture M6) · le
    // registre est interrogé tranche par tranche, jamais tenu en mémoire. Les
    // lignes se comptent par un regroupement sur les SEULES écritures de la
    // tranche · `_count` faisait agréger toute la table des lignes, tous
    // cabinets confondus, à chaque tranche (relecture M2).
    const portee = { tenantId, estANouveauProvisoire: false, ...filtreDuStatut(inclureBrouillard) };
    let derniere: { date: Date; id: string } | undefined;
    let premiereEnAttente: { date: Date; id: string } | undefined;
    for (;;) {
      const lot = await this.prisma.ecriture.findMany({
        where: derniere
          ? { AND: [{ ...portee, tenantId }, apresLaCle([{ champ: 'date', valeur: derniere.date }, { champ: 'id', valeur: derniere.id }])] }
          : { ...portee, tenantId },
        select: { id: true, date: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        take: LOT_LECTURE,
      });
      if (lot.length === 0) break;
      const ids = lot.map((e) => e.id);
      const [connues, comptes] = await Promise.all([
        this.prisma.ecritureExportee.findMany({ where: { tenantId, ecritureId: { in: ids } }, select: { ecritureId: true } }),
        this.prisma.ligneEcriture.groupBy({
          by: ['ecritureId'],
          where: { ecritureId: { in: ids }, ecriture: { tenantId, ...HORS_SITUATION } },
          _count: { _all: true },
        }),
      ]);
      const dejaConnues = new Set(connues.map((c) => c.ecritureId));
      const lignesDe = new Map(comptes.map((c) => [c.ecritureId, c._count._all]));
      for (const e of lot) {
        if (dejaConnues.has(e.id)) continue;
        const n = lignesDe.get(e.id) ?? 0;
        // Une écriture ne se coupe jamais · celle qui ne tient plus sous le
        // plafond attend l'export suivant ENTIÈRE, et les suivantes aussi (on
        // ne saute pas une pièce pour en prendre une plus petite · l'ordre des
        // dates est celui que la receveuse lit). Ce qui attend se COMPTE par
        // la base, jamais en lisant la suite (relecture M2).
        if (n > MAX_LIGNES_EXPORT) horsPlafond ??= { id: e.id, date: e.date, lignes: n, mouvement: 'NOUVELLE' };
        if (enAttente > 0 || horsPlafond !== null || lignes + n > MAX_LIGNES_EXPORT) {
          premiereEnAttente = e;
          break;
        }
        retenues.push({ id: e.id, date: e.date, lignes: n, mouvement: 'NOUVELLE' });
        lignes += n;
      }
      if (premiereEnAttente || lot.length < LOT_LECTURE) break;
      derniere = lot[lot.length - 1];
    }
    if (premiereEnAttente) {
      const attendent = await this.jamaisPartiesDepuis(tenantId, inclureBrouillard, premiereEnAttente);
      // La pièce hors plafond n'attend pas · elle est nommée à part.
      enAttente += horsPlafond?.mouvement === 'NOUVELLE' && horsPlafond.id === premiereEnAttente.id ? attendent - 1 : attendent;
    }

    retenues.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    return {
      dernierNumero,
      retenues,
      supprimees,
      lignes,
      nouvelles: retenues.filter((c) => c.mouvement === 'NOUVELLE').length,
      modifiees: retenues.filter((c) => c.mouvement === 'MODIFIEE').length,
      renvoyees: retenues.filter((c) => c.mouvement === 'RENVOYEE').length,
      enAttente,
      horsPlafond,
      brouillardModifieHorsPortee,
    };
  }

  /** Le contenu de quelques écritures, tel que le fichier le porterait. */
  private contenus(tenantId: string, ids: string[]) {
    return this.prisma.ecriture.findMany({
      where: { tenantId, id: { in: ids }, estANouveauProvisoire: false, ...HORS_SITUATION },
      include: CONTENU_ECRITURE,
    });
  }

  /**
   * Les écritures JAMAIS PARTIES de la portée, à partir de `depuis` compris,
   * dans l'ordre des dates · comptées par la base (NOT EXISTS sur le
   * registre), jamais en lisant la suite (relecture M2). Même portée que la
   * lecture · ni à-nouveau provisoire, ni situation, brouillard selon le choix.
   */
  private async jamaisPartiesDepuis(tenantId: string, inclureBrouillard: boolean, depuis: { date: Date; id: string }): Promise<number> {
    const statut = inclureBrouillard
      ? Prisma.sql`e."statut"::text <> ${StatutEcriture.SITUATION}`
      : Prisma.sql`e."statut"::text = ${StatutEcriture.VALIDEE}`;
    const [ligne] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS "n" FROM "ecritures" e
      WHERE e."tenantId" = ${tenantId}
        AND e."estANouveauProvisoire" = false
        AND ${statut}
        AND (e."date", e."id") >= (${depuis.date}, ${depuis.id})
        AND NOT EXISTS (
          SELECT 1 FROM "ecritures_exportees" r WHERE r."tenantId" = e."tenantId" AND r."ecritureId" = e."id"
        )`;
    return ligne?.n ?? 0;
  }

  /**
   * PRODUIT L'EXPORT · le fichier en mémoire, puis le numéro, le fichier rangé
   * et le registre dans une transaction. Un export complet qui ne tient pas
   * sous le plafond est REFUSÉ (un « complet » amputé se dirait complet) ;
   * l'export des modifications part par lots et dit ce qui attend.
   */
  async exporter(tenantId: string, userId: string, mode: ModeExportEcritures, inclureBrouillard: boolean) {
    const inv = await this.inventaire(tenantId, mode, inclureBrouillard);
    if (inv.horsPlafond) throw new PayloadTooLargeException(await this.motifDuHorsPlafond(tenantId, inv.horsPlafond));
    if (mode === ModeExportEcritures.COMPLET && inv.enAttente > 0) {
      throw new PayloadTooLargeException(
        `L'export complet porterait plus de ${MAX_LIGNES_EXPORT.toLocaleString('fr-FR')} lignes · il est refusé plutôt ` +
          `qu'amputé. Exportez les modifications · elles partent par lots sous ce plafond, chaque lot disant ce qui attend.`,
      );
    }
    if (inv.retenues.length === 0 && inv.supprimees.length === 0) {
      throw new BadRequestException(motifExportVide(inv.dernierNumero));
    }
    const numero = (inv.dernierNumero ?? 0) + 1;
    const produitAt = new Date();
    const auteur = (await this.courriels(tenantId, [userId]))(userId);
    const identite = await this.exportService.identiteEtat(tenantId, {});

    const ecrites = new Map<string, { statut: StatutEcriture; empreinte: string; date: Date; journalCode: string; piece: string; libelle: string }>();
    const decompte = { ecritures: 0, nouvelles: 0, modifiees: 0, lignes: 0 };

    const { nomFichier, contenu } = await produireEnMemoire(async (ouvrir) => {
      const sortie = ouvrir(nomFichierExport(numero, produitAt));
      const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, useSharedStrings: false, useStyles: true });
      classeur.creator = 'OmegaX';
      classeur.created = produitAt;
      const pied = `&L${identite.entite}${segmentIdentification(identite) ? ` · ${segmentIdentification(identite)}` : ''} · export n° ${numero}&RPage &P / &N`;

      // FEUILLE 1 · les écritures, en-tête en ligne 1, comme l'import la lit.
      const feuille = classeur.addWorksheet(FEUILLE_ECRITURES, {
        views: [{ state: 'frozen', ySplit: 1 }],
        headerFooter: { oddFooter: pied },
      });
      feuille.columns = COLONNES_ECHANGE.map((c) => ({ ...c }));
      const pieces = new PiecesDistinctes();
      for (let i = 0; i < inv.retenues.length; i += LOT_EXPORT) {
        const tranche = inv.retenues.slice(i, i + LOT_EXPORT);
        const lues = await this.prisma.ecriture.findMany({
          where: { tenantId, id: { in: tranche.map((c) => c.id) }, estANouveauProvisoire: false, ...HORS_SITUATION },
          include: CONTENU_ECRITURE,
        });
        const parId = new Map(lues.map((e) => [e.id, e]));
        for (const c of tranche) {
          const e = parId.get(c.id);
          // Retirée entre l'inventaire et l'écriture du fichier · jamais
          // partie, rien à dire ; partie avant, le registre la nommera
          // supprimée à l'export suivant.
          if (!e || (!inclureBrouillard && e.statut === StatutEcriture.BROUILLARD)) continue;
          const echange = versEchange(e);
          const empreinte = empreinteEcriture(echange);
          // Le mouvement se relit sur ce qui part · une pièce changée entre
          // l'inventaire et l'écriture part pour ce qu'elle est.
          const mouvement = mouvementDe(c.entree, empreinte);
          const piece = pieces.piece({ id: e.id, date: e.date, journal: echange.journal, numeroPiece: e.numeroPiece });
          const mention = libelleMouvement(mouvement, c.entree, e.statut);
          for (const l of ordonnerLignes(echange.lignes)) {
            feuille
              .addRow({
                date: e.date,
                journal: echange.journal,
                piece,
                reference: e.reference ?? '',
                compte: l.compte,
                libelle: l.libelle ?? e.libelle,
                debit: Number(l.debit),
                credit: Number(l.credit),
                montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
                devise: l.devise ?? '',
                cours: l.cours === null ? null : Number(l.cours),
                echeance: l.echeance ? new Date(`${l.echeance}T00:00:00Z`) : null,
                jourValeur: e.dateValeur,
                statut: libelleDuStatut(e.statut),
                mouvement: mention,
                identifiant: e.id,
              })
              .commit();
            decompte.lignes++;
            await attendreLeTuyau(sortie);
          }
          decompte.ecritures++;
          if (mouvement === 'NOUVELLE') decompte.nouvelles++;
          if (mouvement === 'MODIFIEE') decompte.modifiees++;
          ecrites.set(e.id, { statut: e.statut, empreinte, date: e.date, journalCode: echange.journal, piece, libelle: e.libelle });
        }
      }
      feuille.commit();

      // FEUILLE 2 · ce qui est parti et n'existe plus.
      const supprimees = classeur.addWorksheet(FEUILLE_SUPPRIMEES, { views: [{ state: 'frozen', ySplit: 1 }], headerFooter: { oddFooter: pied } });
      supprimees.columns = COLONNES_SUPPRIMEES.map((c) => ({ ...c }));
      for (const s of inv.supprimees) {
        supprimees
          .addRow({ identifiant: s.ecritureId, date: s.date, journal: s.journalCode, piece: s.piece, libelle: s.libelle, envoyee: s.numeroExport })
          .commit();
        await attendreLeTuyau(sortie);
      }
      supprimees.commit();

      // FEUILLE 3 · l'envoi lui-même · ce que la receveuse cite (art. 22, 7°).
      const recap = classeur.addWorksheet(FEUILLE_EXPORT, { headerFooter: { oddFooter: pied } });
      recap.columns = [
        { header: 'Rubrique', key: 'rubrique', width: 44 },
        { header: 'Valeur', key: 'valeur', width: 60 },
      ];
      const lignesRecap: Array<[string, string | number]> = [
        ['Dossier', identite.entite],
        ['Identification', segmentIdentification(identite) || 'non renseignée'],
        ['Export n°', numero],
        [
          'Portée',
          mode === ModeExportEcritures.COMPLET
            ? 'Export complet'
            : inv.dernierNumero === null
              ? 'Premier export'
              : `Modifications depuis l'export n° ${inv.dernierNumero}`,
        ],
        ['Brouillard compris', inclureBrouillard ? 'Oui' : 'Non, livre-journal seul'],
        ['Produit le', produitAt.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })],
        ['Produit par', auteur],
        ['Écritures portées', decompte.ecritures],
        ['dont nouvelles', decompte.nouvelles],
        ['dont modifiées depuis leur envoi', decompte.modifiees],
        ['Lignes', decompte.lignes],
        ['Écritures supprimées depuis leur envoi', inv.supprimees.length],
        ["Laissées pour l'export suivant (plafond de lignes)", inv.enAttente],
        ...(inclureBrouillard
          ? []
          : ([['Envoyées au brouillard, modifiées depuis, hors de cette portée', inv.brouillardModifieHorsPortee]] as Array<[string, number]>)),
        ['Unité monétaire', identite.devise],
        ['Relecture', MENTION_RELECTURE],
      ];
      for (const [rubrique, valeur] of lignesRecap) recap.addRow({ rubrique, valeur }).commit();
      recap.commit();
      await classeur.commit();
    });

    // Tout ce que l'inventaire retenait a pu être retiré avant l'écriture du
    // fichier · un export qui ne porte plus rien ne prend pas de numéro.
    if (decompte.ecritures === 0 && inv.supprimees.length === 0) {
      throw new BadRequestException(motifExportVide(inv.dernierNumero));
    }
    const empreinte = empreinteFichier(contenu);
    const enregistre = await transactionJournalisee(
      this.prisma,
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`exports-ecritures:${tenantId}`}))`;
        const max = await tx.exportEcritures.aggregate({ where: { tenantId }, _max: { numero: true } });
        if ((max._max.numero ?? null) !== inv.dernierNumero) {
          throw new ConflictException(
            `Un autre export (n° ${max._max.numero}) a été produit pendant celui-ci · rien n'a été rangé, aucun numéro ` +
              "n'est pris. Relancez l'export, il partira de ce nouvel envoi.",
          );
        }
        const cree = await tx.exportEcritures.create({
          data: {
            tenantId,
            numero,
            mode,
            inclureBrouillard,
            produitAt,
            produitPar: userId,
            nombreEcritures: decompte.ecritures,
            nombreNouvelles: decompte.nouvelles,
            nombreModifiees: decompte.modifiees,
            nombreSupprimees: inv.supprimees.length,
            nombreLignes: decompte.lignes,
            nombreEnAttente: inv.enAttente,
            nomFichier,
            taille: contenu.length,
            empreinte,
            contenu,
          },
          select: { id: true },
        });
        const ids = [...ecrites.keys()];
        for (let i = 0; i < ids.length; i += TRANCHE_REGISTRE) {
          const tranche = ids.slice(i, i + TRANCHE_REGISTRE);
          // L'entrée d'une écriture renvoyée est REMPLACÉE · retirée puis
          // recréée en un geste, plutôt qu'une mise à jour par ligne.
          await tx.ecritureExportee.deleteMany({ where: { tenantId, ecritureId: { in: tranche } } });
          await tx.ecritureExportee.createMany({
            data: tranche.map((ecritureId) => {
              const e = ecrites.get(ecritureId)!;
              return {
                tenantId,
                ecritureId,
                numeroExport: numero,
                statutExporte: e.statut,
                empreinte: e.empreinte,
                date: e.date,
                journalCode: e.journalCode,
                piece: e.piece,
                libelle: e.libelle,
              };
            }),
          });
        }
        const supprimeesIds = inv.supprimees.map((s) => s.ecritureId);
        for (let i = 0; i < supprimeesIds.length; i += TRANCHE_REGISTRE) {
          await tx.ecritureExportee.updateMany({
            where: { tenantId, ecritureId: { in: supprimeesIds.slice(i, i + TRANCHE_REGISTRE) }, supprimeeAuNumero: null },
            data: { supprimeeAuNumero: numero },
          });
        }
        return cree;
      },
      { timeout: DELAI_RANGEMENT_MS, maxWait: 10_000 },
    );

    return {
      id: enregistre.id,
      numero,
      mode,
      inclureBrouillard,
      produitAt,
      produitPar: auteur,
      nombreEcritures: decompte.ecritures,
      nombreNouvelles: decompte.nouvelles,
      nombreModifiees: decompte.modifiees,
      nombreSupprimees: inv.supprimees.length,
      nombreLignes: decompte.lignes,
      nombreEnAttente: inv.enAttente,
      brouillardModifieHorsPortee: inv.brouillardModifieHorsPortee,
      nomFichier,
      taille: contenu.length,
      empreinte,
    };
  }

  /** Le fichier d'un export · retéléchargeable tant que le dossier existe. */
  async fichier(tenantId: string, id: string): Promise<{ nomFichier: string; contenu: Buffer }> {
    const exp = await this.prisma.exportEcritures.findFirst({ where: { id, tenantId }, select: { nomFichier: true, contenu: true } });
    if (!exp) throw new NotFoundException('Export introuvable pour ce dossier.');
    return { nomFichier: exp.nomFichier, contenu: Buffer.from(exp.contenu) };
  }

  /** L'auteur en courriel · un utilisateur retiré du dossier se dit tel. */
  private async courriels(tenantId: string, ids: string[]) {
    const auteurs = await this.prisma.user.findMany({
      where: { tenantId, id: { in: [...new Set(ids)] } },
      select: { id: true, email: true },
    });
    const parId = new Map(auteurs.map((u) => [u.id, u.email]));
    return (id: string) => parId.get(id) ?? 'utilisateur retiré du dossier';
  }
}

/** Le type de ce qu'écrit l'export, pour l'écran. */
export type ResultatExport = Awaited<ReturnType<ExportModificationsService['exporter']>>;
