import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EtatEcritureRecue,
  EtatReceptionEchange,
  Prisma,
  StatutEcriture,
  StatutExercice,
  TypeCompteDetailTotal,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../common/prisma.service';
import { transactionJournalisee } from '../../../common/audit/transaction-journalisee';
import { EcritureService, DETENTEUR_ECHANGE, type MemoireControles } from '../../comptabilite/ecriture.service';
import { coursDeLaLigne } from '../../comptabilite/ligne-en-devise';
import { numeroteurDeLot } from '../../journaux/numerotation-piece';
import { estTenueParUnLettrage } from '../../lettrage/ligne-lettree';
import { lireDeviseDeLaLigne } from '../../import/import.service';
import {
  DELAI_RECEPTION_TOMBEE_MS,
  EnvoiIllisible,
  PLAFOND_COMPTE_RENDU,
  decisionPour,
  empreinteDuFichier,
  empreinteRecue,
  lireEnvoi,
  nomDeLaPiece,
  type EcritureLueDansLEnvoi,
  type EntreeRecue,
} from './echange-ecritures';

/** Une ligne prête à écrire · ce que l'import des écritures pose aussi. */
interface LignePrete {
  compteId: string;
  libelle: string;
  debit: number;
  credit: number;
  dateEcheance?: Date;
  deviseId?: string;
  montantDevise?: number;
  coursApplique?: number;
}

/** Une écriture de l'envoi, jugée et prête à naître ou à remplacer celle du dossier. */
interface PiecePrete {
  source: EcritureLueDansLEnvoi;
  nom: string;
  empreinte: string;
  exerciceId: string;
  journalId: string;
  libelle: string;
  lignes: LignePrete[];
  entree: (EntreeRecue & { id: string }) | undefined;
  note: string | null;
}

/** Ce qu'une réception a fait, ou ferait (aperçu). */
export interface CompteRenduReception {
  simulation: boolean;
  receptionId: string | null;
  dossierSource: string;
  numeroExport: number;
  creees: number;
  modifiees: number;
  retirees: number;
  ignorees: number;
  refusees: number;
  /** Ce qui est dit pièce par pièce · bornée, `total` dit tout. */
  pieces: Array<{ piece: string; message: string; refus: boolean }>;
  piecesTotal: number;
  tronque: boolean;
  /** Les avertissements de l'envoi · numéros d'envoi sautés, lignes illisibles. */
  avertissements: string[];
}

const LOT = 1000;

function tranches<T>(elements: T[], taille: number): T[][] {
  const sortie: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) sortie.push(elements.slice(i, i + taille));
  return sortie;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * L'ÉCHANGE D'ÉCRITURES (ligne dossier-l9, fonction 102) · Fichier > Échanger
 * des écritures. Les règles vivent dans `echange-ecritures.ts` · ce service
 * lit, juge et écrit.
 */
@Injectable()
export class EchangeEcrituresService {
  private readonly journalServeur = new Logger(EchangeEcrituresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
  ) {}

  /** Les réceptions du dossier, les plus récentes d'abord, bornées et dites. */
  async lister(tenantId: string) {
    const [receptions, total] = await Promise.all([
      this.prisma.receptionEchange.findMany({
        where: { tenantId },
        orderBy: { recuLe: 'desc' },
        take: 50,
        select: {
          id: true,
          etat: true,
          dossierSource: true,
          numeroExportSource: true,
          nomFichier: true,
          empreinteFichier: true,
          recuLe: true,
          recuPar: true,
          termineeLe: true,
          nombreCreees: true,
          nombreModifiees: true,
          nombreRetirees: true,
          nombreIgnorees: true,
          nombreRefusees: true,
        },
      }),
      this.prisma.receptionEchange.count({ where: { tenantId } }),
    ]);
    const auteurs = await this.courriels(tenantId, receptions.map((r) => r.recuPar));
    return {
      receptions: receptions.map((r) => ({ ...r, recuPar: auteurs(r.recuPar) })),
      total,
      tronque: total > receptions.length,
    };
  }

  /** Le compte rendu gardé d'une réception. */
  async detail(tenantId: string, id: string) {
    const r = await this.prisma.receptionEchange.findFirst({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Réception introuvable pour ce dossier.');
    return { ...r, recuPar: (await this.courriels(tenantId, [r.recuPar]))(r.recuPar) };
  }

  /** Les écritures reçues, par état, bornées et dites · les plus récentes d'abord. */
  async recues(tenantId: string, etat: EtatEcritureRecue | undefined) {
    const [lues, total] = await Promise.all([
      this.prisma.ecritureRecue.findMany({
        where: { tenantId, ...(etat ? { etat } : {}) },
        orderBy: { recueLe: 'desc' },
        take: 200,
        select: {
          id: true,
          etat: true,
          identifiantSource: true,
          numeroExportSource: true,
          recueLe: true,
          detacheeLe: true,
          ecritureId: true,
          ecritureDetacheeId: true,
          ecriture: {
            select: { numeroPiece: true, date: true, libelle: true, statut: true, journal: { select: { code: true } } },
          },
        },
      }),
      this.prisma.ecritureRecue.count({ where: { tenantId, ...(etat ? { etat } : {}) } }),
    ]);
    return { recues: lues, total, tronque: total > lues.length };
  }

  /**
   * DÉTACHER UNE ÉCRITURE REÇUE · le dossier qui reçoit en prend la main. Elle
   * n'est plus retenue par l'échange, se modifie et se supprime comme toute
   * écriture du brouillard, et les envois suivants de l'expéditeur ne la
   * touchent plus (ils le disent). Un `updateMany` filtré sur l'état TENUE ·
   * deux gestes concurrents n'en font qu'un.
   */
  async detacher(tenantId: string, userId: string, id: string) {
    const lue = await this.prisma.ecritureRecue.findFirst({ where: { id, tenantId }, select: { etat: true, ecritureId: true } });
    if (!lue) throw new NotFoundException('Écriture reçue introuvable pour ce dossier.');
    if (lue.etat !== EtatEcritureRecue.TENUE || lue.ecritureId === null) {
      throw new ConflictException("Cette écriture n'est plus tenue par l'échange · rien à détacher.");
    }
    const fait = await this.prisma.ecritureRecue.updateMany({
      where: { id, tenantId, etat: EtatEcritureRecue.TENUE, ecritureId: lue.ecritureId },
      data: {
        etat: EtatEcritureRecue.DETACHEE,
        ecritureId: null,
        ecritureDetacheeId: lue.ecritureId,
        detacheeLe: new Date(),
        detacheePar: userId,
      },
    });
    if (fait.count !== 1) throw new ConflictException("L'écriture a changé pendant le détachement · relisez la liste.");
    return { detachee: true };
  }

  /**
   * RECEVOIR UN ENVOI, ou le simuler · tout est lu et jugé avant la première
   * écriture ; une pièce refusée l'est nommément sans emporter les autres. Les
   * créations passent d'un seul tenant, comme l'import des écritures ; chaque
   * remplacement et chaque retrait dans SA transaction, le registre avec lui ·
   * une réception interrompue se reprend sur le même fichier sans rien créer
   * deux fois.
   */
  async recevoir(
    tenantId: string,
    userId: string,
    dto: { nomFichier: string; contenuBase64: string },
    simulation: boolean,
  ): Promise<CompteRenduReception> {
    if (!/\.xlsx$/i.test(dto.nomFichier)) {
      throw new BadRequestException("Seul le classeur Excel de l'export des modifications (.xlsx) se relit ici.");
    }
    const contenu = Buffer.from(dto.contenuBase64, 'base64');
    if (contenu.length === 0) throw new BadRequestException('Le fichier est vide.');
    const empreinteFichier = empreinteDuFichier(contenu);
    let envoi;
    try {
      envoi = await lireEnvoi(contenu);
    } catch (e) {
      if (e instanceof EnvoiIllisible) throw new BadRequestException(e.message);
      throw e;
    }

    // LE MÊME FICHIER NE SE RELIT PAS · sauf une réception tombée en route.
    const existante = await this.prisma.receptionEchange.findFirst({ where: { tenantId, empreinteFichier } });
    if (existante?.etat === EtatReceptionEchange.TERMINEE) {
      throw new ConflictException(
        `Ce fichier a déjà été reçu le ${existante.recuLe.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })} ` +
          `(envoi n° ${existante.numeroExportSource} de « ${existante.dossierSource} ») · rien n'est relu.`,
      );
    }
    if (existante && Date.now() - existante.recuLe.getTime() < DELAI_RECEPTION_TOMBEE_MS) {
      throw new ConflictException('Ce fichier est en cours de réception sur un autre poste · attendez la fin, puis relisez la liste.');
    }

    // L'ENVOI D'UN AUTRE DOSSIER · un identifiant qui est une écriture de ce
    // dossier-ci dit que le fichier en vient · le relire créerait chaque pièce
    // une seconde fois.
    const identifiants = [...envoi.ecritures.map((e) => e.identifiant), ...envoi.suppressions.map((s) => s.identifiant)];
    for (const lot of tranches(identifiants, LOT)) {
      const propres = await this.prisma.ecriture.count({ where: { tenantId, id: { in: lot } } });
      if (propres > 0) {
        throw new BadRequestException(
          "Ce fichier est un export de CE dossier · ses écritures y sont déjà. L'échange relit l'envoi d'un AUTRE dossier OmegaX.",
        );
      }
    }

    const avertissements: string[] = envoi.illisibles.slice(0, 20).map((i) => `Ligne ${i.rang} · ${i.message}`);
    if (envoi.illisibles.length > 20) avertissements.push(`… et ${envoi.illisibles.length - 20} autres lignes illisibles.`);
    const precedente = await this.prisma.receptionEchange.findFirst({
      where: { tenantId, dossierSource: envoi.dossierSource, etat: EtatReceptionEchange.TERMINEE },
      orderBy: { numeroExportSource: 'desc' },
      select: { numeroExportSource: true },
    });
    if (precedente && envoi.numeroExport > precedente.numeroExportSource + 1) {
      avertissements.push(
        `Les envois n° ${precedente.numeroExportSource + 1}` +
          (envoi.numeroExport - 1 > precedente.numeroExportSource + 1 ? ` à ${envoi.numeroExport - 1}` : '') +
          ` de « ${envoi.dossierSource} » n'ont pas été reçus ici · relisez-les d'abord, dans l'ordre, s'ils existent.`,
      );
    }
    if (precedente && envoi.numeroExport < precedente.numeroExportSource) {
      avertissements.push(
        `Cet envoi (n° ${envoi.numeroExport}) précède le dernier reçu de « ${envoi.dossierSource} » (n° ${precedente.numeroExportSource}) · ` +
          "une écriture déjà reçue d'un envoi plus récent n'est pas changée.",
      );
    }

    // LE CONTEXTE DU DOSSIER · exercices, journaux, comptes, devises, registre.
    const [exercices, journaux, comptes, devises] = await Promise.all([
      this.prisma.exercice.findMany({ where: { tenantId }, select: { id: true, dateDebut: true, dateFin: true, statut: true } }),
      this.prisma.journal.findMany({ where: { tenantId }, select: { id: true, code: true, numerotation: true, type: true } }),
      this.prisma.compte.findMany({ where: { tenantId }, select: { id: true, numero: true, typeCompte: true } }),
      this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } }),
    ]);
    const journauxParCode = new Map(journaux.map((j) => [j.code.toUpperCase(), j]));
    const journauxParId = new Map(journaux.map((j) => [j.id, j]));
    const comptesParNumero = new Map(comptes.map((c) => [c.numero, c]));
    const devisesParCode = new Map(devises.map((d) => [d.code.toUpperCase(), d]));
    const registre = new Map<string, EntreeRecue & { id: string }>();
    for (const lot of tranches(identifiants, LOT)) {
      const entrees = await this.prisma.ecritureRecue.findMany({
        where: { tenantId, identifiantSource: { in: lot } },
        select: { id: true, identifiantSource: true, etat: true, ecritureId: true, empreinteSource: true, numeroExportSource: true },
      });
      for (const e of entrees) registre.set(e.identifiantSource, e);
    }

    const pieces: CompteRenduReception['pieces'] = [];
    let ignorees = 0;
    let refusees = 0;
    const dire = (piece: string, texte: string, refus: boolean) => {
      if (refus) refusees++;
      else ignorees++;
      pieces.push({ piece, message: texte, refus });
    };

    // JUGER CHAQUE ÉCRITURE DE L'ENVOI · la décision du registre, puis les
    // règles de l'import des écritures.
    const memoire: MemoireControles = new Map();
    const aCreer: PiecePrete[] = [];
    const aRemplacer: PiecePrete[] = [];
    for (const e of envoi.ecritures) {
      const nom = nomDeLaPiece(e);
      const empreinte = empreinteRecue(e);
      const entree = registre.get(e.identifiant);
      const decision = decisionPour(entree, empreinte, envoi.numeroExport, e.mouvement);
      if (decision.action === 'LAISSER') {
        dire(nom, decision.motif, decision.refus);
        continue;
      }
      const jugee = await this.juger(tenantId, e, { exercices, journauxParCode, comptesParNumero, devisesParCode, memoire });
      if (typeof jugee === 'string') {
        dire(nom, jugee, true);
        continue;
      }
      const prete: PiecePrete = {
        source: e,
        nom,
        empreinte,
        ...jugee,
        entree,
        note: decision.action === 'CREER' ? decision.note : null,
      };
      if (decision.action === 'CREER') {
        aCreer.push(prete);
        continue;
      }
      // REMPLACER · seulement une écriture du dossier encore au brouillard,
      // dans un exercice ouvert, que rien d'autre ne tient (art. 22, 2°).
      const refus = await this.motifRefusRemplacement(tenantId, entree!.ecritureId!);
      if (refus) dire(nom, refus, true);
      else aRemplacer.push(prete);
    }

    // LES RETRAITS DE L'EXPÉDITEUR.
    const aRetirer: Array<{ nom: string; entree: EntreeRecue & { id: string } }> = [];
    for (const s of envoi.suppressions) {
      const nom = nomDeLaPiece(s);
      const entree = registre.get(s.identifiant);
      if (!entree) {
        dire(nom, "retirée par l'expéditeur, jamais reçue ici · rien à retirer", false);
        continue;
      }
      if (entree.etat === EtatEcritureRecue.DETACHEE) {
        dire(nom, "retirée par l'expéditeur, mais détachée de l'échange dans ce dossier · laissée, à retirer à la main si elle doit l'être", true);
        continue;
      }
      if (entree.etat === EtatEcritureRecue.RETIREE_PAR_LA_SOURCE || entree.ecritureId === null) {
        dire(nom, 'déjà retirée', false);
        continue;
      }
      const refus = await this.motifRefusRemplacement(tenantId, entree.ecritureId);
      if (refus) dire(nom, refus.replace('ne se remplace plus', 'ne se retire plus'), true);
      else aRetirer.push({ nom, entree });
    }

    const rendu = (receptionId: string | null, creees: number, modifiees: number, retirees: number): CompteRenduReception => ({
      simulation,
      receptionId,
      dossierSource: envoi.dossierSource,
      numeroExport: envoi.numeroExport,
      creees,
      modifiees,
      retirees,
      ignorees,
      refusees,
      pieces: pieces.slice(0, PLAFOND_COMPTE_RENDU),
      piecesTotal: pieces.length,
      tronque: pieces.length > PLAFOND_COMPTE_RENDU,
      avertissements,
    });
    for (const p of aCreer) if (p.note) pieces.push({ piece: p.nom, message: p.note, refus: false });
    if (simulation) return rendu(null, aCreer.length, aRemplacer.length, aRetirer.length);

    // LA RÉCEPTION NAÎT AVANT LA PREMIÈRE ÉCRITURE · elle est la pièce que le
    // registre cite (art. 22, 7°). Une réception tombée se reprend.
    let receptionId: string;
    if (existante) {
      receptionId = existante.id;
      await this.prisma.receptionEchange.update({ where: { id: existante.id }, data: { recuLe: new Date(), recuPar: userId } });
    } else {
      try {
        receptionId = (
          await this.prisma.receptionEchange.create({
            data: {
              tenantId,
              dossierSource: envoi.dossierSource,
              numeroExportSource: envoi.numeroExport,
              nomFichier: dto.nomFichier.slice(0, 200),
              empreinteFichier,
              recuPar: userId,
            },
            select: { id: true },
          })
        ).id;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Ce fichier est en cours de réception sur un autre poste · attendez la fin, puis relisez la liste.');
        }
        throw e;
      }
    }

    // 1 · LES CRÉATIONS, D'UN SEUL TENANT, comme l'import des écritures.
    let creees = 0;
    if (aCreer.length > 0) {
      try {
        creees = await this.creerLesPieces(tenantId, userId, receptionId, envoi.numeroExport, aCreer, journauxParId);
      } catch (e) {
        for (const p of aCreer) dire(p.nom, `${this.motifDeLEchec(e, receptionId)} · aucune des écritures nouvelles de l'envoi n'a été créée`, true);
      }
    }

    // 2 · LES REMPLACEMENTS, chacun avec son registre.
    let modifiees = 0;
    for (const p of aRemplacer) {
      try {
        await this.remplacer(tenantId, userId, receptionId, envoi.numeroExport, p, journauxParId);
        modifiees++;
      } catch (e) {
        dire(p.nom, `${this.motifDeLEchec(e, receptionId)} · l'écriture du dossier n'a pas été remplacée`, true);
      }
    }

    // 3 · LES RETRAITS, chacun avec son registre.
    let retirees = 0;
    for (const r of aRetirer) {
      try {
        await this.ecritures.supprimer(tenantId, r.entree.ecritureId!, {
          detenteur: DETENTEUR_ECHANGE,
          liberer: (tx) =>
            tx.ecritureRecue.update({
              where: { id: r.entree.id },
              data: { etat: EtatEcritureRecue.RETIREE_PAR_LA_SOURCE, ecritureId: null, derniereReceptionId: receptionId, numeroExportSource: envoi.numeroExport },
            }),
        });
        retirees++;
      } catch (e) {
        dire(r.nom, `${this.motifDeLEchec(e, receptionId)} · l'écriture du dossier n'a pas été retirée`, true);
      }
    }

    await this.prisma.receptionEchange.update({
      where: { id: receptionId },
      data: {
        etat: EtatReceptionEchange.TERMINEE,
        termineeLe: new Date(),
        nombreCreees: creees,
        nombreModifiees: modifiees,
        nombreRetirees: retirees,
        nombreIgnorees: ignorees,
        nombreRefusees: refusees,
        compteRendu: { pieces: pieces.slice(0, PLAFOND_COMPTE_RENDU), total: pieces.length, avertissements } as unknown as Prisma.InputJsonValue,
      },
    });
    return rendu(receptionId, creees, modifiees, retirees);
  }

  /**
   * LES RÈGLES DE L'IMPORT DES ÉCRITURES, pour une écriture de l'envoi ·
   * exercice ouvert qui contient sa date, journal et comptes du dossier,
   * compte de détail, devise, équilibre, puis les contrôles d'entrée de la
   * saisie. Rend le motif du refus, ou la pièce prête.
   */
  private async juger(
    tenantId: string,
    e: EcritureLueDansLEnvoi,
    ctx: {
      exercices: Array<{ id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice }>;
      journauxParCode: Map<string, { id: string; code: string }>;
      comptesParNumero: Map<string, { id: string; numero: string; typeCompte: TypeCompteDetailTotal }>;
      devisesParCode: Map<string, { id: string; code: string }>;
      memoire: MemoireControles;
    },
  ): Promise<Pick<PiecePrete, 'exerciceId' | 'journalId' | 'libelle' | 'lignes'> | string> {
    const exercice = ctx.exercices.find((x) => x.dateDebut <= e.date && e.date <= x.dateFin);
    if (!exercice) return "aucun exercice du dossier ne couvre sa date · créez l'exercice, puis relisez le fichier";
    if (exercice.statut === StatutExercice.CLOTURE) return "sa date tombe dans un exercice clôturé · elle n'est pas reçue";
    const journal = ctx.journauxParCode.get(e.journal);
    if (!journal) return `journal « ${e.journal} » inconnu du dossier · créez-le sous ce code, puis relisez le fichier`;
    const lignes: LignePrete[] = [];
    for (const l of e.lignes) {
      const compte = ctx.comptesParNumero.get(l.compte);
      if (!compte) return `le compte ${l.compte} n'existe pas dans le plan du dossier`;
      if (compte.typeCompte === TypeCompteDetailTotal.TOTAL) return `le compte ${l.compte} est un compte Total, non mouvementable`;
      if (Math.abs(l.debit) < 0.005 && Math.abs(l.credit) < 0.005) continue;
      const lue = lireDeviseDeLaLigne(l.devise, l.montantDevise, l.cours, l.compte, ctx.devisesParCode, Math.abs(l.debit - l.credit));
      const ligne: LignePrete = { compteId: compte.id, libelle: l.libelle, debit: l.debit, credit: l.credit };
      if (l.echeance) ligne.dateEcheance = l.echeance;
      if (lue.enDevise) {
        if (lue.refus !== null) return lue.refus;
        ligne.deviseId = lue.deviseId;
        ligne.montantDevise = lue.montantDevise;
        if (lue.coursApplique !== undefined) ligne.coursApplique = lue.coursApplique;
      }
      lignes.push(ligne);
    }
    const d = lignes.reduce((s, l) => s + l.debit, 0);
    const c = lignes.reduce((s, l) => s + l.credit, 0);
    if (lignes.length < 2 || Math.abs(d - c) > 0.005) {
      return `pièce déséquilibrée ou incomplète (débit ${d.toFixed(2)}, crédit ${c.toFixed(2)}, ${lignes.length} ligne(s))`;
    }
    try {
      await this.ecritures.controlesDEntree(
        tenantId,
        { exerciceId: exercice.id, journalId: journal.id, date: e.date, lignes, exigerVentilationObligatoire: false },
        undefined,
        ctx.memoire,
      );
    } catch (err) {
      return message(err);
    }
    return { exerciceId: exercice.id, journalId: journal.id, libelle: e.lignes[0]?.libelle || `Reçue de l'envoi n° ${e.piece}`, lignes };
  }

  /**
   * UNE ÉCRITURE DU DOSSIER SE REMPLACE OU SE RETIRE-T-ELLE ? · au brouillard,
   * dans un exercice ouvert, sans ligne lettrée ni pointée, et tenue par le
   * seul échange. Rend le motif du refus, ou null.
   */
  private async motifRefusRemplacement(tenantId: string, ecritureId: string): Promise<string | null> {
    const locale = await this.prisma.ecriture.findFirst({
      where: { id: ecritureId, tenantId },
      select: {
        statut: true,
        numeroPiece: true,
        exercice: { select: { statut: true } },
        lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } },
      },
    });
    if (!locale) return "l'écriture reçue n'existe plus dans ce dossier";
    if (locale.statut !== StatutEcriture.BROUILLARD) {
      return (
        `validée dans ce dossier (pièce n° ${locale.numeroPiece ?? 'sans numéro'}) · elle ne se remplace plus (AUDCIF art. 22, 2°) ; ` +
        "si l'expéditeur l'a corrigée, passez la correction par inscription en négatif (art. 20, al. 2)"
      );
    }
    if (locale.exercice.statut === StatutExercice.CLOTURE) return "son exercice est clôturé dans ce dossier · elle ne se remplace plus";
    if (locale.lignes.some((l) => estTenueParUnLettrage(l) || l.rapprochementId !== null)) {
      return 'une de ses lignes est lettrée ou pointée dans ce dossier · défaites le lettrage ou le pointage, puis relisez le fichier';
    }
    const autres = (await this.ecritures.detenteursDeLEcriture(tenantId, ecritureId)).filter((d) => d !== DETENTEUR_ECHANGE);
    if (autres.length > 0) return `elle est tenue dans ce dossier par ${autres.join(', ')} · elle ne se remplace plus`;
    return null;
  }

  /** Les écritures nouvelles de l'envoi et leur registre, d'une seule transaction. */
  private async creerLesPieces(
    tenantId: string,
    userId: string,
    receptionId: string,
    numeroExport: number,
    pieces: PiecePrete[],
    journauxParId: Map<string, { id: string; numerotation: import('@prisma/client').NumerotationPiece; type: import('@prisma/client').TypeJournal }>,
  ): Promise<number> {
    await transactionJournalisee(
      this.prisma,
      async (tx) => {
        const numeroteurs = new Map<string, ReturnType<typeof numeroteurDeLot>>();
        const ecrites: Array<PiecePrete & { id: string; numeroPiece: number | null }> = [];
        // Dans l'ordre des dates · les numéros se suivent comme la saisie les aurait donnés.
        for (const p of [...pieces].sort((a, b) => a.source.date.getTime() - b.source.date.getTime())) {
          let numeroter = numeroteurs.get(p.exerciceId);
          if (!numeroter) {
            numeroter = numeroteurDeLot(tx, tenantId, p.exerciceId);
            numeroteurs.set(p.exerciceId, numeroter);
          }
          ecrites.push({ ...p, id: randomUUID(), numeroPiece: await numeroter(journauxParId.get(p.journalId)!, p.source.date) });
        }
        for (const lot of tranches(ecrites, LOT)) {
          await tx.ecriture.createMany({
            data: lot.map((p) => ({
              id: p.id,
              tenantId,
              exerciceId: p.exerciceId,
              journalId: p.journalId,
              numeroPiece: p.numeroPiece,
              date: p.source.date,
              libelle: p.libelle,
              reference: p.source.reference,
              createdBy: userId,
            })),
          });
        }
        const lignes = ecrites.flatMap((p) => p.lignes.map((l) => ({ ...this.versLigne(l), ecritureId: p.id })));
        for (const lot of tranches(lignes, 5000)) await tx.ligneEcriture.createMany({ data: lot });
        // LE REGISTRE · une entrée neuve, ou celle d'un remplacement interrompu.
        const neuves = ecrites.filter((p) => !p.entree);
        for (const lot of tranches(neuves, LOT)) {
          await tx.ecritureRecue.createMany({
            data: lot.map((p) => ({
              tenantId,
              identifiantSource: p.source.identifiant,
              ecritureId: p.id,
              empreinteSource: p.empreinte,
              numeroExportSource: numeroExport,
              premiereReceptionId: receptionId,
              derniereReceptionId: receptionId,
            })),
          });
        }
        for (const p of ecrites.filter((x) => x.entree)) {
          await tx.ecritureRecue.update({
            where: { id: p.entree!.id },
            data: { etat: EtatEcritureRecue.TENUE, ecritureId: p.id, empreinteSource: p.empreinte, numeroExportSource: numeroExport, derniereReceptionId: receptionId },
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
    return pieces.length;
  }

  /**
   * REMPLACER UNE ÉCRITURE REÇUE · EN PLACE au brouillard, même numéro, quand
   * elle reste dans son exercice et son journal (`modifierPieceDuModule`) ;
   * sinon retirée puis recréée · le registre est dénoué dans la transaction du
   * retrait, et une recréation interrompue se reprend au fichier suivant
   * (entrée TENUE sans écriture).
   */
  private async remplacer(
    tenantId: string,
    userId: string,
    receptionId: string,
    numeroExport: number,
    p: PiecePrete,
    journauxParId: Map<string, { id: string; numerotation: import('@prisma/client').NumerotationPiece; type: import('@prisma/client').TypeJournal }>,
  ) {
    const ecritureId = p.entree!.ecritureId!;
    const locale = await this.prisma.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { exerciceId: true, journalId: true } });
    if (!locale) throw new ConflictException("l'écriture reçue n'existe plus dans ce dossier");
    if (locale.exerciceId === p.exerciceId && locale.journalId === p.journalId) {
      const enPlace = await transactionJournalisee(this.prisma, async (tx) => {
        const fait = await this.ecritures.modifierPieceDuModule(
          tx,
          tenantId,
          ecritureId,
          {
            date: p.source.date.toISOString().slice(0, 10),
            libelle: p.libelle,
            reference: p.source.reference,
            exigerVentilationObligatoire: false,
            lignes: p.lignes.map((l) => ({
              compteId: l.compteId,
              libelle: l.libelle || undefined,
              debit: l.debit,
              credit: l.credit,
              ...(l.dateEcheance ? { dateEcheance: l.dateEcheance.toISOString().slice(0, 10) } : {}),
              ...(l.deviseId ? { deviseId: l.deviseId, montantDevise: l.montantDevise, coursApplique: coursDeLaLigne(l) } : {}),
            })),
          },
          userId,
        );
        if (!fait) return false;
        await tx.ecritureRecue.update({
          where: { id: p.entree!.id },
          data: { empreinteSource: p.empreinte, numeroExportSource: numeroExport, derniereReceptionId: receptionId },
        });
        return true;
      });
      if (enPlace) return;
    }
    // Autre exercice, autre journal, ou autre mois d'un journal numéroté par mois.
    await this.ecritures.supprimer(tenantId, ecritureId, {
      detenteur: DETENTEUR_ECHANGE,
      liberer: (tx) => tx.ecritureRecue.update({ where: { id: p.entree!.id }, data: { ecritureId: null } }),
    });
    await this.creerLesPieces(tenantId, userId, receptionId, numeroExport, [{ ...p, entree: { ...p.entree!, ecritureId: null } }], journauxParId);
  }

  private versLigne(l: LignePrete) {
    return {
      compteId: l.compteId,
      libelle: l.libelle || undefined,
      debit: l.debit,
      credit: l.credit,
      dateEcheance: l.dateEcheance,
      deviseId: l.deviseId,
      montantDevise: l.montantDevise,
      coursApplique: coursDeLaLigne(l),
    };
  }

  /** Les auteurs nommés par leur courriel · un utilisateur retiré du dossier le dit. */
  private async courriels(tenantId: string, ids: string[]) {
    const uniques = [...new Set(ids)];
    const lus = uniques.length
      ? await this.prisma.user.findMany({ where: { tenantId, id: { in: uniques } }, select: { id: true, email: true } })
      : [];
    const parId = new Map(lus.map((u) => [u.id, u.email]));
    return (id: string) => parId.get(id) ?? 'utilisateur retiré du dossier';
  }

  /**
   * Une écriture qui n'a pas pu s'écrire · le refus nommé (exception HTTP) se
   * dit tel quel ; une panne de la base se dit aussi, et se consigne au
   * journal du serveur avec la réception · jamais avalée.
   */
  private motifDeLEchec(e: unknown, receptionId: string): string {
    if (e instanceof HttpException) return message(e);
    this.journalServeur.error(`Réception ${receptionId} · écriture non écrite · ${message(e)}`);
    return `panne pendant l'écriture (${message(e)})`;
  }
}
