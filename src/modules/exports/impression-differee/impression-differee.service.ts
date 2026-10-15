import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Writable } from 'node:stream';
import { EtatImpressionDifferee, NatureImpressionDifferee, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../common/prisma.service';
import { transactionJournalisee } from '../../../common/audit/transaction-journalisee';
import { ExportService } from '../export.service';
import { ExportFpmService } from '../export-fpm.service';
import { produireEnMemoire } from '../fichier-en-memoire';
import {
  type CriteresBalance,
  type CriteresGrandLivre,
  type CriteresImpression,
  type CriteresJournal,
  DELAI_PRODUCTION_MS,
  MOTIF_INTERROMPUE,
  PLAFOND_IMPRESSIONS_LISTEES,
  criteresOuMotif,
  estInterrompue,
  libelleDemande,
  motifEchecDe,
} from './impression-differee';

/** Ce qu'une demande montre · jamais son fichier. */
const RESUME = {
  id: true,
  numero: true,
  nature: true,
  libelle: true,
  etat: true,
  demandeLe: true,
  demandePar: true,
  commenceLe: true,
  produitLe: true,
  motifEchec: true,
  nomFichier: true,
  taille: true,
  empreinte: true,
  fichierRetireLe: true,
} satisfies Prisma.ImpressionDiffereeSelect;

/** Une production rangée ou refusée prend au plus ce temps pour s'écrire. */
const DELAI_RANGEMENT_MS = 120_000;

/**
 * L'IMPRESSION DIFFÉRÉE (ligne sage-l7, fonction 59) · règles dans
 * `impression-differee.ts`.
 *
 * TROIS TEMPS, CHACUN COURT SAUF LA PRODUCTION. (1) La demande prend son
 * numéro sous un verrou par dossier et se range EN ATTENTE · ses critères
 * sont relus, l'exercice et le journal jugés du dossier, avant tout numéro.
 * (2) `traiter` prend la plus ancienne demande en attente (une production à
 * la fois par dossier · deux livres de cette taille sur une instance ne sont
 * couverts par aucune mesure, docs/capacite-mesuree.md), la passe EN COURS,
 * puis la produit HORS transaction par le moteur de l'export du même livre.
 * (3) Le fichier se range dans une transaction courte, seulement si la
 * demande est encore celle qui a été prise · une demande déclarée
 * interrompue entre-temps ne se voit pas rangée par un processus qu'on
 * croyait mort.
 *
 * LA PRODUCTION SE FAIT DANS UNE REQUÊTE · Cloud Run n'alloue le processeur
 * que pendant les requêtes (le déploiement ne lui demande pas l'inverse) ; un
 * travail lancé après la réponse y serait ralenti jusqu'à l'arrêt. L'écran
 * appelle donc `traiter` après la demande et tant qu'il en reste en attente.
 */
@Injectable()
export class ImpressionDiffereeService {
  private readonly logger = new Logger(ImpressionDiffereeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
    private readonly exportFpm: ExportFpmService,
  ) {}

  /** Enregistre la demande, numérotée, EN ATTENTE · rien n'est encore produit. */
  async demander(tenantId: string, userId: string, nature: NatureImpressionDifferee, brut: Record<string, unknown>) {
    const lu = criteresOuMotif(nature, brut);
    if ('motif' in lu) throw new BadRequestException(lu.motif);
    const { criteres } = lu;
    const exercice = await this.prisma.exercice.findFirst({
      where: { id: criteres.exerciceId, tenantId },
      select: { dateDebut: true, dateFin: true },
    });
    if (!exercice) throw new NotFoundException("Exercice introuvable pour ce dossier.");
    let journal: { code: string } | null = null;
    if (nature === NatureImpressionDifferee.JOURNAL && (criteres as CriteresJournal).journalId) {
      journal = await this.prisma.journal.findFirst({
        where: { id: (criteres as CriteresJournal).journalId!, tenantId },
        select: { code: true },
      });
      if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    }
    const libelle = libelleDemande(nature, criteres, exercice, journal);
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`impressions-differees:${tenantId}`}))`;
      const max = await tx.impressionDifferee.aggregate({ where: { tenantId }, _max: { numero: true } });
      return tx.impressionDifferee.create({
        data: {
          tenantId,
          numero: (max._max.numero ?? 0) + 1,
          nature,
          criteres: criteres as unknown as Prisma.InputJsonValue,
          libelle,
          demandePar: userId,
        },
        select: RESUME,
      });
    });
  }

  /**
   * Produit la plus ancienne demande EN ATTENTE du dossier, s'il n'en est
   * aucune en cours · et déclare d'abord INTERROMPUE toute production
   * commencée au-delà du délai. Rend la demande traitée (ou rien) et ce qui
   * attend encore.
   */
  async traiter(tenantId: string) {
    await this.declarerInterrompues(tenantId);
    const prise = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`impressions-differees:${tenantId}`}))`;
      const enCours = await tx.impressionDifferee.count({ where: { tenantId, etat: EtatImpressionDifferee.EN_COURS } });
      if (enCours > 0) return null;
      const suivante = await tx.impressionDifferee.findFirst({
        where: { tenantId, etat: EtatImpressionDifferee.EN_ATTENTE },
        orderBy: { numero: 'asc' },
        select: { id: true, nature: true, criteres: true, demandePar: true },
      });
      if (!suivante) return null;
      const commenceLe = new Date();
      await tx.impressionDifferee.update({
        where: { id: suivante.id },
        data: { etat: EtatImpressionDifferee.EN_COURS, commenceLe },
      });
      return { ...suivante, commenceLe };
    });

    let traitee = null;
    if (prise) {
      let resultat: { etat: 'PRETE'; nomFichier: string; contenu: Buffer } | { etat: 'ECHOUEE'; motif: string };
      try {
        const { nomFichier, contenu } = await produireEnMemoire((ouvrir) =>
          this.produire(tenantId, prise.nature, prise.criteres as unknown as CriteresImpression, prise.demandePar, ouvrir),
        );
        resultat = { etat: 'PRETE', nomFichier, contenu };
      } catch (erreur) {
        // Le refus nommé du moteur est une réponse (plafond, exercice) ; une
        // panne se consigne ici, son détail ne part pas à l'écran.
        if (!(erreur instanceof HttpException)) {
          this.logger.error(`Impression différée ${prise.id} · production en échec`, erreur instanceof Error ? erreur.stack : String(erreur));
        }
        resultat = { etat: 'ECHOUEE', motif: motifEchecDe(erreur) };
      }
      traitee = await this.ranger(tenantId, prise.id, prise.commenceLe, resultat);
    }
    const enAttente = await this.prisma.impressionDifferee.count({ where: { tenantId, etat: EtatImpressionDifferee.EN_ATTENTE } });
    return { traitee, enAttente };
  }

  /** Les demandes du dossier, les plus récentes d'abord, sans leur fichier. */
  async lister(tenantId: string) {
    const [lues, total, enAttente] = await Promise.all([
      this.prisma.impressionDifferee.findMany({
        where: { tenantId },
        orderBy: { numero: 'desc' },
        take: PLAFOND_IMPRESSIONS_LISTEES,
        select: RESUME,
      }),
      this.prisma.impressionDifferee.count({ where: { tenantId } }),
      this.prisma.impressionDifferee.count({ where: { tenantId, etat: EtatImpressionDifferee.EN_ATTENTE } }),
    ]);
    const auteurs = await this.prisma.user.findMany({
      where: { tenantId, id: { in: [...new Set(lues.map((d) => d.demandePar))] } },
      select: { id: true, email: true },
    });
    const courriel = new Map(auteurs.map((u) => [u.id, u.email]));
    const maintenant = new Date();
    return {
      impressions: lues.map((d) => ({
        ...d,
        demandePar: courriel.get(d.demandePar) ?? 'utilisateur retiré du dossier',
        // Lue, jamais écrite ici · la déclaration se fait par `traiter`.
        interrompue: estInterrompue(d.etat, d.commenceLe, maintenant),
      })),
      total,
      tronque: total > lues.length,
      enAttente,
    };
  }

  /** Le fichier d'une impression PRÊTE · une demande en attente ou échouée n'en a pas. */
  async fichier(tenantId: string, id: string): Promise<{ nomFichier: string; contenu: Buffer }> {
    const d = await this.prisma.impressionDifferee.findFirst({
      where: { id, tenantId },
      select: { numero: true, etat: true, nomFichier: true, contenu: true, fichierRetireLe: true },
    });
    if (!d) throw new NotFoundException('Impression introuvable pour ce dossier.');
    if (d.etat !== EtatImpressionDifferee.PRETE) {
      throw new ConflictException(`L'impression n° ${d.numero} n'est pas prête · aucun fichier à télécharger.`);
    }
    if (!d.contenu || !d.nomFichier) {
      throw new ConflictException(`Le fichier de l'impression n° ${d.numero} a été retiré · demandez l'édition de nouveau.`);
    }
    return { nomFichier: d.nomFichier, contenu: Buffer.from(d.contenu) };
  }

  /**
   * Retire le fichier d'une impression PRÊTE, pour libérer la place · la
   * demande, son numéro, sa date et l'empreinte du fichier restent (AUDCIF
   * art. 22, 7°), le fichier se redemande. Une mise à jour UNITAIRE, au
   * journal d'audit.
   */
  async retirerFichier(tenantId: string, id: string) {
    const d = await this.prisma.impressionDifferee.findFirst({
      where: { id, tenantId },
      select: { id: true, numero: true, etat: true, fichierRetireLe: true },
    });
    if (!d) throw new NotFoundException('Impression introuvable pour ce dossier.');
    if (d.etat !== EtatImpressionDifferee.PRETE) {
      throw new ConflictException(`L'impression n° ${d.numero} n'a pas de fichier à retirer.`);
    }
    if (d.fichierRetireLe) throw new ConflictException(`Le fichier de l'impression n° ${d.numero} est déjà retiré.`);
    return this.prisma.impressionDifferee.update({
      where: { id: d.id },
      data: { contenu: null, fichierRetireLe: new Date() },
      select: RESUME,
    });
  }

  /** Le livre, par le moteur de son export · le même plafond refuse avant le premier octet. */
  private produire(
    tenantId: string,
    nature: NatureImpressionDifferee,
    criteres: CriteresImpression,
    demandePar: string,
    ouvrir: (nomFichier: string) => Writable,
  ): Promise<unknown> {
    if (nature === NatureImpressionDifferee.JOURNAL) {
      const c = criteres as CriteresJournal;
      return this.exportService.journalExcelEnFlux(
        tenantId,
        {
          exerciceId: c.exerciceId,
          journalId: c.journalId ?? undefined,
          dateDebut: c.dateDebut ?? undefined,
          dateFin: c.dateFin ?? undefined,
          inclureBrouillard: c.inclureBrouillard,
        },
        ouvrir,
        // Le journal entier produit s'enregistre comme imprimé, au nom de qui
        // l'a demandé (ligne sage-l1, fonction 60), comme l'export direct.
        demandePar,
      );
    }
    if (nature === NatureImpressionDifferee.GRAND_LIVRE) {
      const c = criteres as CriteresGrandLivre;
      return c.format === 'plat'
        ? this.exportService.grandLivreCompletExcelEnFlux(tenantId, c.exerciceId, ouvrir)
        : this.exportFpm.grandLivreEnFlux(tenantId, c.exerciceId, ouvrir);
    }
    const c = criteres as CriteresBalance;
    return this.exportFpm.balanceGeneraleEnFlux(tenantId, c.exerciceId, c.grandsLivres, ouvrir);
  }

  /**
   * Range le résultat d'une production, seulement si la demande est encore
   * EN COURS et prise au même instant · sinon (déclarée interrompue entre-temps)
   * rien n'est rangé, et c'est consigné.
   */
  private async ranger(
    tenantId: string,
    id: string,
    commenceLe: Date,
    resultat: { etat: 'PRETE'; nomFichier: string; contenu: Buffer } | { etat: 'ECHOUEE'; motif: string },
  ) {
    return transactionJournalisee(
      this.prisma,
      async (tx) => {
        const [ligne] = await tx.$queryRaw<{ etat: string; commenceLe: Date | null }[]>`
          SELECT "etat"::text AS "etat", "commenceLe" FROM "impressions_differees"
          WHERE "id" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
        if (!ligne || ligne.etat !== EtatImpressionDifferee.EN_COURS || ligne.commenceLe?.getTime() !== commenceLe.getTime()) {
          this.logger.warn(`Impression différée ${id} · production finie après son interruption déclarée, rien n'est rangé.`);
          return tx.impressionDifferee.findFirst({ where: { id, tenantId }, select: RESUME });
        }
        return tx.impressionDifferee.update({
          where: { id },
          data:
            resultat.etat === 'PRETE'
              ? {
                  etat: EtatImpressionDifferee.PRETE,
                  produitLe: new Date(),
                  nomFichier: resultat.nomFichier,
                  taille: resultat.contenu.length,
                  empreinte: createHash('sha256').update(resultat.contenu).digest('hex'),
                  contenu: resultat.contenu,
                }
              : { etat: EtatImpressionDifferee.ECHOUEE, produitLe: new Date(), motifEchec: resultat.motif },
          select: RESUME,
        });
      },
      { timeout: DELAI_RANGEMENT_MS, maxWait: 10_000 },
    );
  }

  /** Toute production commencée au-delà du délai devient ÉCHOUÉE, une à une, au journal d'audit. */
  private async declarerInterrompues(tenantId: string) {
    const limite = new Date(Date.now() - DELAI_PRODUCTION_MS);
    const anciennes = await this.prisma.impressionDifferee.findMany({
      where: { tenantId, etat: EtatImpressionDifferee.EN_COURS, commenceLe: { lt: limite } },
      orderBy: { numero: 'asc' },
      take: PLAFOND_IMPRESSIONS_LISTEES,
      select: { id: true, commenceLe: true },
    });
    for (const a of anciennes) {
      await transactionJournalisee(this.prisma, async (tx) => {
        const [ligne] = await tx.$queryRaw<{ etat: string; commenceLe: Date | null }[]>`
          SELECT "etat"::text AS "etat", "commenceLe" FROM "impressions_differees"
          WHERE "id" = ${a.id} AND "tenantId" = ${tenantId} FOR UPDATE`;
        if (!ligne || ligne.etat !== EtatImpressionDifferee.EN_COURS || ligne.commenceLe?.getTime() !== a.commenceLe?.getTime()) return;
        await tx.impressionDifferee.update({
          where: { id: a.id },
          data: { etat: EtatImpressionDifferee.ECHOUEE, produitLe: new Date(), motifEchec: MOTIF_INTERROMPUE },
        });
      });
    }
  }
}
