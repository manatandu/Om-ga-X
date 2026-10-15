import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Writable } from 'node:stream';
import { EtatImpressionDifferee, NatureImpressionDifferee, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../common/prisma.service';
import { transactionJournalisee } from '../../../common/audit/transaction-journalisee';
import { ExportService } from '../export.service';
import { ExportFpmService } from '../export-fpm.service';
import { produireEnMemoire } from '../fichier-en-memoire';
import { pageDeNumeros } from '../pagination-par-numero';
import { enregistrerImpressionDans } from '../../journaux/impressions-journal';
import {
  type CriteresBalance,
  type CriteresGrandLivre,
  type CriteresImpression,
  type CriteresJournal,
  DELAI_PRODUCTION_MS,
  MOTIF_INTERROMPUE,
  MOTIF_NON_RANGEE,
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
      // LES CRITÈRES GARDÉS SE RELISENT PAR LA RÈGLE QUI LES A ADMIS
      // (relecture TypeScript, mineur 7) · une conversion de type les prenait
      // pour sûrs ; une demande dont les critères ne se relisent plus échoue,
      // motif dit, au lieu d'une panne au milieu du moteur.
      const relus = criteresOuMotif(prise.nature, objetOuVide(prise.criteres));
      const criteres = 'criteres' in relus ? relus.criteres : null;
      try {
        if (!criteres) throw new BadRequestException(`Critères de la demande illisibles · ${'motif' in relus ? relus.motif : ''}`);
        const { nomFichier, contenu } = await produireEnMemoire((ouvrir) => this.produire(tenantId, prise.nature, criteres, ouvrir));
        resultat = { etat: 'PRETE', nomFichier, contenu };
      } catch (erreur) {
        // Le refus nommé du moteur est une réponse (plafond, exercice) ; une
        // panne se consigne ici, son détail ne part pas à l'écran.
        if (!(erreur instanceof HttpException)) {
          this.logger.error(`Impression différée ${prise.id} · production en échec`, erreur instanceof Error ? erreur.stack : String(erreur));
        }
        resultat = { etat: 'ECHOUEE', motif: motifEchecDe(erreur) };
      }
      try {
        traitee = await this.ranger(tenantId, { ...prise, criteres }, resultat);
      } catch (erreur) {
        // UN FICHIER QUI NE SE RANGE PAS NE LAISSE PAS LA DEMANDE EN COURS
        // (relecture m4) · elle passe ÉCHOUÉE, motif nommé, et c'est consigné ;
        // sans cela elle restait « en cours » jusqu'au délai d'interruption.
        this.logger.error(
          `Impression différée ${prise.id} · le résultat n'a pas pu être rangé`,
          erreur instanceof Error ? erreur.stack : String(erreur),
        );
        traitee = await this.ranger(tenantId, { ...prise, criteres }, { etat: 'ECHOUEE', motif: MOTIF_NON_RANGEE });
      }
    }
    const enAttente = await this.prisma.impressionDifferee.count({ where: { tenantId, etat: EtatImpressionDifferee.EN_ATTENTE } });
    return { traitee, enAttente };
  }

  /** Les demandes du dossier, les plus récentes d'abord, sans leur fichier. */
  async lister(tenantId: string, avant?: number) {
    const [lusEtSurplus, total, enAttente] = await Promise.all([
      this.prisma.impressionDifferee.findMany({
        where: { tenantId, ...(avant !== undefined ? { numero: { lt: avant } } : {}) },
        orderBy: { numero: 'desc' },
        // Un de plus que la page · il dit qu'il en reste de plus anciens (m5).
        take: PLAFOND_IMPRESSIONS_LISTEES + 1,
        select: RESUME,
      }),
      this.prisma.impressionDifferee.count({ where: { tenantId } }),
      this.prisma.impressionDifferee.count({ where: { tenantId, etat: EtatImpressionDifferee.EN_ATTENTE } }),
    ]);
    const { page: lues, plusAnciensAvant } = pageDeNumeros(lusEtSurplus, PLAFOND_IMPRESSIONS_LISTEES);
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
      plusAnciensAvant,
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
    // Le tampon rendu par Prisma, tel quel · jamais une seconde copie (mineur 8).
    return { nomFichier: d.nomFichier, contenu: d.contenu };
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
    ouvrir: (nomFichier: string) => Writable,
  ): Promise<unknown> {
    if (nature === NatureImpressionDifferee.JOURNAL) {
      // SANS auteur · le moteur ne marque pas le journal imprimé ici. Le
      // journal produit ne s'enregistre comme imprimé (ligne sage-l1,
      // fonction 60) qu'une fois son fichier RANGÉ, dans la même transaction
      // (`ranger`, relecture M4) · marqué avant, un rangement manqué laissait
      // un journal « imprimé » sans document remis.
      return this.exportService.journalExcelEnFlux(tenantId, filtresDuJournal(criteres as CriteresJournal), ouvrir);
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
    prise: { id: string; commenceLe: Date; nature: NatureImpressionDifferee; criteres: CriteresImpression | null; demandePar: string },
    resultat: { etat: 'PRETE'; nomFichier: string; contenu: Buffer } | { etat: 'ECHOUEE'; motif: string },
  ) {
    const { id, commenceLe } = prise;
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
        const rangee = await tx.impressionDifferee.update({
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
        // LE JOURNAL PRODUIT ET RANGÉ EST UN JOURNAL IMPRIMÉ (ligne sage-l1,
        // fonction 60 ; AUDCIF art. 22, 7°), au nom de qui l'a demandé, dans
        // la transaction qui range son fichier · l'un sans l'autre jamais
        // (relecture M4).
        if (resultat.etat === 'PRETE' && prise.nature === NatureImpressionDifferee.JOURNAL && prise.criteres) {
          const impression = await this.exportService.impressionDuJournal(
            tx,
            tenantId,
            filtresDuJournal(prise.criteres as CriteresJournal),
            prise.demandePar,
          );
          if (impression) await enregistrerImpressionDans(tx, impression);
        }
        return rangee;
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

/** Les filtres du moteur du journal, tirés des critères figés de la demande. */
function filtresDuJournal(c: CriteresJournal) {
  return {
    exerciceId: c.exerciceId,
    journalId: c.journalId ?? undefined,
    dateDebut: c.dateDebut ?? undefined,
    dateFin: c.dateFin ?? undefined,
    inclureBrouillard: c.inclureBrouillard,
  };
}


/** Les critères gardés en JSON, lus comme un objet · tout autre JSON (nul, tableau, scalaire) se relit vide et échoue. */
function objetOuVide(valeur: Prisma.JsonValue): Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
}
