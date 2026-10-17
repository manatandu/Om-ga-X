import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur, StatutMessage } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { horsCloisonnement } from '../../../common/cloisonnement/contexte-cloisonnement';
import { transactionJournalisee } from '../../../common/audit/transaction-journalisee';
import { jourDeKinshasa } from '../../../common/echeance';
import { CourrierService, ORIGINE_RAPPEL_SUPPRESSION_ESSAI } from '../../courrier/courrier.service';
import { ORIGINE_INSCRIPTION_ESSAI } from '../../auth/inscription-essai';
import { JOURS_ESSAI } from '../abonnements/facturation-abonnements';
import { PLAFOND_LISTE_CONSOLE, tranche } from '../plafond-console';
import { avisRappelSuppression } from './courriel-rappel';
import { dateDeSuppression, etatDeLEssai, FaitsDossierEssai, VerdictEssai } from './essais-echus';
import { purgerDossier } from './purger-dossier';

/**
 * LES DOSSIERS D'ESSAI ÉCHUS, DANS LA CONSOLE DE L'ÉDITEUR (décision de Manasse
 * du 2026-10-17 · conservés cent quatre-vingts jours après leur terme, rappel au
 * moins trente jours avant, puis supprimés).
 *
 * LA SUPPRESSION EST UN GESTE DE L'OPÉRATEUR, JAMAIS UNE TÂCHE PLANIFIÉE · Cloud
 * Run n'a pas d'ordonnanceur dans ce dépôt (un `setInterval` serait perdu au
 * premier recyclage d'instance et doublé dès qu'une seconde monte), et un
 * effacement irréversible gagne à rester une décision prise devant la liste. Ce
 * service lit, envoie les rappels que l'opérateur demande, et supprime ce que
 * l'opérateur désigne, après avoir relu tout le calendrier sous verrou.
 *
 * VMG NE VOIT JAMAIS LES INFORMATIONS D'UN CLIENT (CLAUDE.md § 8) · la liste rend
 * des identifiants, des dates, un état et des NOMBRES. Ni le nom de l'entité, ni
 * l'adresse de l'administrateur, ni un compte, ni un montant ne quittent le
 * serveur. L'adresse n'est lue que pour envoyer le rappel, et part dans le
 * courriel, jamais dans la réponse.
 *
 * TOUT CE QUI TOUCHE UN DOSSIER AUTRE QUE CELUI DE L'OPÉRATEUR SORT DU
 * CLOISONNEMENT, et le dit (`horsCloisonnement`, liste gelée par
 * `cloisonnement.spec.ts`).
 */

/** Une réponse du rappel pour un dossier · jamais un silence. */
export type IssueRappel = 'ENVOYE' | 'EN_FILE' | 'DEJA_ENVOYE' | 'EN_COURS' | 'SANS_ADMINISTRATEUR' | 'ECHEC' | 'NON_DU';

export interface ResultatRappel {
  tenantId: string;
  issue: IssueRappel;
  /** Le motif en clair quand ce n'est pas un envoi. */
  detail: string | null;
}

export interface LigneEssaiEchu {
  tenantId: string;
  etat: VerdictEssai['etat'];
  termeLe: string | null;
  conserveJusquAu: string | null;
  supprimableLe: string | null;
  rappelDepuisLe: string | null;
  rappel: { misEnFileLe: string; envoyeLe: string | null; statutCourrier: StatutMessage | null; erreur: string | null } | null;
  nombreUtilisateurs: number;
  nombreExercices: number;
  nombreEcritures: number;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Un rappel mis en file depuis plus de ceci sans message est celui d'un processus tombé. */
const DELAI_RAPPEL_ORPHELIN_MS = 15 * 60_000;

/** Le dossier entier à purger peut être long · borne de la transaction. */
const OPTIONS_SUPPRESSION = { maxWait: 10_000, timeout: 120_000 };

interface DossierLu {
  faits: FaitsDossierEssai;
  nombreUtilisateurs: number;
  nombreExercices: number;
  nombreEcritures: number;
  rappelId: string | null;
  rappelMessageId: string | null;
  rappelMisEnFileLe: Date | null;
  rappelEnvoyeLe: Date | null;
}

type Lecteur = PrismaService | Prisma.TransactionClient;

@Injectable()
export class EssaisEchusService {
  private readonly logger = new Logger(EssaisEchusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courrier: CourrierService,
  ) {}

  /**
   * Les dossiers dont la licence est un essai de trente jours échu · la sélection
   * est faite par la base (même durée et même tolérance que `estUnDossierDEssai`,
   * qui reste la règle appliquée ensuite en code). Les identifiants seulement.
   */
  private async candidats(client: Lecteur, maintenant: Date): Promise<{ ids: string[]; total: number }> {
    const secondes = JOURS_ESSAI * 86_400;
    const lignes = await client.$queryRaw<{ tenantId: string }[]>`
      SELECT "tenantId" FROM "licences"
      WHERE "type" = 'ABONNEMENT'::"TypeLicence"
        AND "dateExpiration" IS NOT NULL
        AND "dateExpiration" <= ${maintenant}
        AND abs(extract(epoch FROM ("dateExpiration" - "dateDebut")) - ${secondes}) <= 60
      ORDER BY "dateExpiration" ASC, "tenantId" ASC
      LIMIT ${PLAFOND_LISTE_CONSOLE}`;
    const [{ n }] = await client.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "licences"
      WHERE "type" = 'ABONNEMENT'::"TypeLicence"
        AND "dateExpiration" IS NOT NULL
        AND "dateExpiration" <= ${maintenant}
        AND abs(extract(epoch FROM ("dateExpiration" - "dateDebut")) - ${secondes}) <= 60`;
    return { ids: lignes.map((l) => l.tenantId), total: Number(n) };
  }

  /**
   * Lit, pour chaque dossier, tout ce que le calendrier et les refus exigent ·
   * par lots, une requête par table pour tous les dossiers (jamais une par
   * dossier). Appelé hors cloisonnement par ses appelants.
   */
  private async lire(client: Lecteur, ids: string[]): Promise<Map<string, DossierLu>> {
    if (ids.length === 0) return new Map();
    const [tenants, licences, abonnements, mereOuCellule, tiersCellule, preuves, rappels, utilisateurs, exercices, ecritures] = await Promise.all([
      client.tenant.findMany({
        where: { id: { in: ids } },
        select: { id: true, estDemonstration: true, dossierMereId: true, dossierCombinaisonId: true },
      }),
      client.licence.findMany({
        where: { tenantId: { in: ids } },
        select: { tenantId: true, type: true, statut: true, dateDebut: true, dateExpiration: true },
      }),
      client.abonnementCabinet.findMany({ where: { cabinetId: { in: ids } }, select: { cabinetId: true } }),
      client.tenant.findMany({
        where: { OR: [{ dossierMereId: { in: ids } }, { dossierCombinaisonId: { in: ids } }] },
        select: { dossierMereId: true, dossierCombinaisonId: true },
      }),
      // Une lecture ENTRE dossiers, déclarée (`cloisonnement.spec.ts`) · le siège d'un groupe
      // porte, dans SON dossier, la cellule qu'il vise ; ce n'est pas le dossier visé qui la porte.
      client.tiers.findMany({ where: { celluleGroupeId: { in: ids } }, select: { celluleGroupeId: true } }),
      client.message.findMany({
        where: { tenantId: { in: ids }, origine: ORIGINE_INSCRIPTION_ESSAI, origineId: { in: ids } },
        select: { tenantId: true, origineId: true },
      }),
      client.rappelSuppressionEssai.findMany({ where: { cabinetId: { in: ids } } }),
      client.user.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids } }, _count: { _all: true } }),
      client.exercice.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids } }, _count: { _all: true } }),
      client.ecriture.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids } }, _count: { _all: true } }),
    ]);

    const parTenant = <T extends { tenantId: string }>(l: T[]) => new Map(l.map((x) => [x.tenantId, x]));
    const licenceDe = parTenant(licences);
    const compte = (g: { tenantId: string; _count: { _all: number } }[]) => new Map(g.map((x) => [x.tenantId, x._count._all]));
    const nUtilisateurs = compte(utilisateurs);
    const nExercices = compte(exercices);
    const nEcritures = compte(ecritures);
    const avecAbonnement = new Set(abonnements.map((a) => a.cabinetId));
    const groupe = new Set<string>();
    for (const t of mereOuCellule) {
      if (t.dossierMereId) groupe.add(t.dossierMereId);
      if (t.dossierCombinaisonId) groupe.add(t.dossierCombinaisonId);
    }
    for (const t of tiersCellule) if (t.celluleGroupeId) groupe.add(t.celluleGroupeId);
    const inscrits = new Set(preuves.filter((p) => p.origineId === p.tenantId).map((p) => p.tenantId));
    const rappelDe = new Map(rappels.map((r) => [r.cabinetId, r]));

    const resultat = new Map<string, DossierLu>();
    for (const t of tenants) {
      const l = licenceDe.get(t.id) ?? null;
      const r = rappelDe.get(t.id) ?? null;
      resultat.set(t.id, {
        faits: {
          licence: l ? { type: l.type, statut: l.statut, dateDebut: l.dateDebut, dateExpiration: l.dateExpiration } : null,
          estDemonstration: t.estDemonstration,
          toucheUnGroupe: t.dossierMereId !== null || t.dossierCombinaisonId !== null || groupe.has(t.id),
          aUnAbonnement: avecAbonnement.has(t.id),
          inscritParEssai: inscrits.has(t.id),
          rappel: r ? { envoyeLe: r.envoyeLe } : null,
        },
        nombreUtilisateurs: nUtilisateurs.get(t.id) ?? 0,
        nombreExercices: nExercices.get(t.id) ?? 0,
        nombreEcritures: nEcritures.get(t.id) ?? 0,
        rappelId: r?.id ?? null,
        rappelMessageId: r?.messageId || null,
        rappelMisEnFileLe: r?.misEnFileLe ?? null,
        rappelEnvoyeLe: r?.envoyeLe ?? null,
      });
    }
    return resultat;
  }

  /**
   * La liste de la console · les dossiers d'essai échus que le calendrier
   * concerne, avec leur état. Un dossier NON CONCERNÉ (abonné, groupe, vitrine…)
   * n'y paraît pas · la console ne propose que ce qu'elle pourrait supprimer.
   * Tranche qui se dit (`tronque`, `total`), conformément à § 8 bis.
   */
  async lister(maintenant: Date = new Date()) {
    return horsCloisonnement('console · dossiers d’essai échus', async () => {
      const { ids, total } = await this.candidats(this.prisma, maintenant);
      const lus = await this.lire(this.prisma, ids);
      const statuts = await this.statutsDesRappels(ids.flatMap((id) => (lus.get(id) ? [{ tenantId: id, lu: lus.get(id) as DossierLu }] : [])));
      const lignes: LigneEssaiEchu[] = [];
      for (const id of ids) {
        const l = lus.get(id);
        if (!l) continue;
        const v = etatDeLEssai(l.faits, maintenant);
        if (v.etat === 'NON_CONCERNE' || v.etat === 'EN_COURS') continue;
        const message = l.rappelMessageId ? statuts.get(l.rappelMessageId) ?? null : null;
        lignes.push({
          tenantId: id,
          etat: v.etat,
          termeLe: iso(v.termeLe),
          conserveJusquAu: iso(v.conserveJusquAu),
          supprimableLe: iso(v.supprimableLe),
          rappelDepuisLe: iso(v.rappelDepuisLe),
          rappel: l.rappelMisEnFileLe
            ? {
                misEnFileLe: l.rappelMisEnFileLe.toISOString(),
                envoyeLe: l.rappelEnvoyeLe ? l.rappelEnvoyeLe.toISOString() : null,
                statutCourrier: message?.statut ?? null,
                erreur: message?.erreur ?? null,
              }
            : null,
          nombreUtilisateurs: l.nombreUtilisateurs,
          nombreExercices: l.nombreExercices,
          nombreEcritures: l.nombreEcritures,
        });
      }
      return { essais: lignes, ...tranche(ids.length, total) };
    });
  }

  /** L'état courant des messages de rappel (statut et erreur seulement, jamais le corps ni l'adresse). */
  private async statutsDesRappels(dossiers: { tenantId: string; lu: DossierLu }[]) {
    const portes = dossiers.filter((d) => d.lu.rappelMessageId);
    if (portes.length === 0) return new Map<string, { statut: StatutMessage; erreur: string | null }>();
    const messages = await this.prisma.message.findMany({
      where: {
        id: { in: portes.map((d) => d.lu.rappelMessageId as string) },
        tenantId: { in: portes.map((d) => d.tenantId) },
      },
      select: { id: true, statut: true, erreur: true },
    });
    return new Map(messages.map((m) => [m.id, { statut: m.statut, erreur: m.erreur }]));
  }

  // ----------------------------------------------------------------------
  // LES RAPPELS
  // ----------------------------------------------------------------------

  /**
   * Envoie le rappel à chaque dossier dont l'heure est venue (`RAPPEL_A_ENVOYER`),
   * à l'ADMINISTRATEUR du dossier, UNE FOIS par dossier.
   *
   * · SANS MESSAGERIE, RIEN N'EST FAIT (409) · un rappel qui ne part pas ne vaut
   *   rien, et le calendrier de suppression en dépend.
   * · UN RAPPEL N'EST « PARTI » QUE QUAND SON MESSAGE L'EST. Le message est écrit
   *   dans la file du dossier PUIS tenté (`mettreEnFile`) ; s'il n'est pas parti,
   *   la ligne de suivi le garde SANS date d'envoi (le dossier n'est pas
   *   supprimable), et l'appel suivant RETENTE ce message précis (`retenter`),
   *   jamais un second.
   * · JAMAIS EN DOUBLON · la ligne de suivi est RÉSERVÉE avant l'envoi (clé unique
   *   par dossier) ; un second appel, simultané ou non, trouve la réservation et
   *   passe son chemin. Un processus tombé entre la réservation et l'envoi laisse
   *   une réservation sans message, reprise après quinze minutes, qui ADOPTE le
   *   message déjà écrit s'il existe plutôt que d'en écrire un second.
   * · UN ÉCHEC SE DIT · chaque dossier rend son issue et son motif, un dossier en
   *   échec n'arrête pas les autres, et rien n'est avalé.
   */
  async envoyerRappels(operateur: { userId: string; email: string }, maintenant: Date = new Date()) {
    if (!this.courrier.etatDuTransport().configure) {
      throw new ConflictException(
        'Aucune messagerie n’est configurée · un rappel qui ne part pas ne vaut pas préavis. Configurez la messagerie, puis recommencez.',
      );
    }
    return horsCloisonnement('console · rappels de suppression des dossiers d’essai échus', async () => {
      const { ids, total } = await this.candidats(this.prisma, maintenant);
      const lus = await this.lire(this.prisma, ids);
      const resultats: ResultatRappel[] = [];
      for (const id of ids) {
        const l = lus.get(id);
        if (!l) continue;
        const v = etatDeLEssai(l.faits, maintenant);
        // Ni un dossier hors calendrier, ni un dossier dont le rappel est déjà
        // parti (état ECHU_CONSERVE ou SUPPRIMABLE avec envoyeLe).
        if (v.etat !== 'RAPPEL_A_ENVOYER') continue;
        try {
          resultats.push(await this.rappelerUn(id, l, v, operateur, maintenant));
        } catch (erreur) {
          const detail = erreur instanceof Error ? erreur.message : String(erreur);
          this.logger.error(`Rappel de suppression · échec pour le dossier ${id} · ${detail}`);
          resultats.push({ tenantId: id, issue: 'ECHEC', detail });
        }
      }
      const compte = (i: IssueRappel) => resultats.filter((r) => r.issue === i).length;
      return {
        resultats,
        envoyes: compte('ENVOYE') + compte('DEJA_ENVOYE'),
        enFile: compte('EN_FILE'),
        echecs: compte('ECHEC') + compte('SANS_ADMINISTRATEUR'),
        // Une tranche qui se dit (§ 8 bis) · les dossiers au-delà de la borne n'ont pas été examinés,
        // et « aucun rappel à envoyer » ne doit jamais couvrir ce silence.
        ...tranche(ids.length, total),
      };
    });
  }

  private async rappelerUn(
    tenantId: string,
    lu: DossierLu,
    verdict: VerdictEssai,
    operateur: { userId: string; email: string },
    maintenant: Date,
  ): Promise<ResultatRappel> {
    // 1. Une ligne de suivi existe déjà.
    if (lu.rappelId) {
      if (lu.rappelEnvoyeLe) return { tenantId, issue: 'DEJA_ENVOYE', detail: null };
      if (lu.rappelMessageId) return this.constaterOuRetenter(tenantId, lu.rappelId, lu.rappelMessageId, maintenant);
      const ancien = lu.rappelMisEnFileLe ? maintenant.getTime() - lu.rappelMisEnFileLe.getTime() : 0;
      if (ancien < DELAI_RAPPEL_ORPHELIN_MS) {
        return { tenantId, issue: 'EN_COURS', detail: 'Un envoi est déjà en cours pour ce dossier.' };
      }
      // Réservation d'un processus tombé · libérée, puis reprise comme un premier envoi.
      await this.prisma.rappelSuppressionEssai.deleteMany({ where: { id: lu.rappelId, messageId: '', envoyeLe: null } });
    }

    // 2. Le destinataire · l'administrateur le plus ancien, actif. Rien d'autre.
    const admin = await this.prisma.user.findFirst({
      where: { tenantId, role: RoleUtilisateur.ADMIN_CABINET, estActif: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { email: true },
    });
    if (!admin) {
      return { tenantId, issue: 'SANS_ADMINISTRATEUR', detail: 'Aucun administrateur actif dans ce dossier · le rappel ne peut pas partir.' };
    }

    // 3. Réservation avant l'envoi · la clé unique ferme le doublon.
    const supprimableLe = dateDeSuppression(verdict.termeLe as Date, maintenant);
    let reservation: { id: string };
    try {
      reservation = await this.prisma.rappelSuppressionEssai.create({
        data: { cabinetId: tenantId, messageId: '', supprimableLe, parOperateur: operateur.email },
        select: { id: true },
      });
    } catch (erreur) {
      if ((erreur as { code?: string })?.code === 'P2002') {
        return { tenantId, issue: 'EN_COURS', detail: 'Un autre envoi a réservé ce dossier à l’instant.' };
      }
      throw erreur;
    }

    try {
      // 4. Un message déjà écrit pour ce dossier (processus tombé après l'écriture) est ADOPTÉ.
      const existant = await this.prisma.message.findFirst({
        where: {
          tenantId,
          origine: ORIGINE_RAPPEL_SUPPRESSION_ESSAI,
          origineId: tenantId,
          statut: { not: StatutMessage.ABANDONNE },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, statut: true, envoyeAt: true, erreur: true },
      });
      let messageId: string;
      let statut: StatutMessage;
      let envoyeAt: Date | null = null;
      let erreur: string | null = null;
      if (existant) {
        messageId = existant.id;
        statut = existant.statut;
        envoyeAt = existant.envoyeAt;
        erreur = existant.erreur;
      } else {
        const avis = avisRappelSuppression({ termeLe: verdict.termeLe as Date, supprimableLe });
        const envoi = await this.courrier.mettreEnFile(tenantId, {
          destinataire: admin.email,
          sujet: avis.sujet,
          corps: avis.corps,
          origine: ORIGINE_RAPPEL_SUPPRESSION_ESSAI,
          origineId: tenantId,
          createdBy: operateur.userId,
        });
        messageId = envoi.id;
        statut = envoi.statut;
        envoyeAt = statut === StatutMessage.ENVOYE ? maintenant : null;
        erreur = envoi.erreur;
      }
      await this.prisma.rappelSuppressionEssai.update({
        where: { id: reservation.id },
        data: { messageId, envoyeLe: statut === StatutMessage.ENVOYE ? (envoyeAt ?? maintenant) : null },
      });
      if (statut === StatutMessage.ENVOYE) return { tenantId, issue: 'ENVOYE', detail: null };
      return { tenantId, issue: 'EN_FILE', detail: erreur ?? `Le message est ${statut} · il sera retenté à la prochaine demande.` };
    } catch (echec) {
      // L'envoi n'a pas pu s'écrire (adresse inutilisable, base) · la réservation
      // est LIBÉRÉE pour qu'un nouvel appel puisse réessayer, et l'erreur remonte.
      await this.prisma.rappelSuppressionEssai
        .deleteMany({ where: { id: reservation.id, messageId: '', envoyeLe: null } })
        .catch((e) => this.logger.error(`Rappel de suppression · réservation du dossier ${tenantId} non libérée · ${e instanceof Error ? e.message : e}`));
      throw echec;
    }
  }

  /** Un rappel en file : il est parti (on le constate), ou on retente CE message, jamais un autre. */
  private async constaterOuRetenter(tenantId: string, rappelId: string, messageId: string, maintenant: Date): Promise<ResultatRappel> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId },
      select: { id: true, statut: true, envoyeAt: true, erreur: true },
    });
    if (!message) {
      // Le message a disparu de la file · on ne présume rien, la réservation est libérée et un nouvel appel écrira un autre message.
      await this.prisma.rappelSuppressionEssai.deleteMany({ where: { id: rappelId, envoyeLe: null } });
      return { tenantId, issue: 'ECHEC', detail: 'Le message du rappel est introuvable dans la file du dossier · la réservation est levée, recommencez.' };
    }
    let statut = message.statut;
    let envoyeAt = message.envoyeAt;
    let erreur = message.erreur;
    if (statut === StatutMessage.ABANDONNE) {
      await this.prisma.rappelSuppressionEssai.deleteMany({ where: { id: rappelId, envoyeLe: null } });
      return { tenantId, issue: 'ECHEC', detail: `Le message est abandonné après plusieurs essais (${erreur ?? 'cause non gardée'}) · la réservation est levée, recommencez.` };
    }
    if (statut !== StatutMessage.ENVOYE) {
      const r = await this.courrier.retenter(tenantId, messageId);
      statut = r.statut;
      erreur = r.erreur;
      envoyeAt = statut === StatutMessage.ENVOYE ? maintenant : envoyeAt;
    }
    if (statut === StatutMessage.ENVOYE) {
      await this.prisma.rappelSuppressionEssai.update({ where: { id: rappelId }, data: { envoyeLe: envoyeAt ?? maintenant } });
      return { tenantId, issue: 'ENVOYE', detail: null };
    }
    return { tenantId, issue: 'EN_FILE', detail: erreur ?? `Le message est ${statut}.` };
  }

  // ----------------------------------------------------------------------
  // LA SUPPRESSION
  // ----------------------------------------------------------------------

  /**
   * SUPPRIME un dossier d'essai échu · irréversible.
   *
   * · L'OPÉRATEUR RETAPE L'IDENTIFIANT (`confirmation`) · ni un clic, ni un
   *   identifiant d'une autre ligne.
   * · TOUT EST RELU SOUS VERROU DANS LA TRANSACTION · verrou consultatif du
   *   dossier et verrou de sa ligne (`FOR UPDATE`, qui retient aussi toute
   *   insertion concurrente par clé étrangère), puis le calendrier est rejoué sur
   *   ce qu'on vient de lire. Une licence prolongée, un abonnement enregistré, un
   *   dossier rattaché à un groupe entre l'affichage de la liste et le clic font
   *   REFUSER la suppression (409) · le geste ne se fonde jamais sur la liste.
   * · REFUSÉ SI L'ÉTAT N'EST PAS `SUPPRIMABLE` · rappel PARTI (message constaté
   *   envoyé) depuis au moins trente jours, terme + cent quatre-vingts jours
   *   dépassés.
   * · UNE SEULE TRANSACTION · la purge (`purgerDossier`), le dossier, puis la
   *   trace (`DossierEssaiSupprime`, nombres seulement, journalisée dans la chaîne
   *   du dossier de l'opérateur, le dossier supprimé n'en ayant plus). Une seule
   *   ligne restante fait lever la clé étrangère et tout s'annule.
   */
  async supprimer(
    tenantId: string,
    operateur: { userId: string; email: string },
    confirmation: string,
    maintenant: Date = new Date(),
  ) {
    if ((confirmation ?? '').trim() !== tenantId) {
      throw new BadRequestException('Retapez l’identifiant du dossier pour confirmer la suppression.');
    }
    return horsCloisonnement('console · suppression d’un dossier d’essai échu', () =>
      transactionJournalisee(
        this.prisma,
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suppression-essai:${tenantId}`}))`;
          const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "tenants" WHERE "id" = ${tenantId} FOR UPDATE`;
          if (verrou.length === 0) throw new NotFoundException('Dossier introuvable · il a peut-être déjà été supprimé.');

          const lus = await this.lire(tx, [tenantId]);
          const lu = lus.get(tenantId);
          if (!lu) throw new NotFoundException('Dossier introuvable.');
          const verdict = etatDeLEssai(lu.faits, maintenant);
          if (verdict.etat !== 'SUPPRIMABLE') {
            throw new ConflictException(this.motifDeRefus(verdict, lu));
          }
          // Le rappel n'est parti que si son message l'est · relu, jamais cru sur la seule ligne de suivi.
          const rappel = lu.rappelMessageId
            ? await tx.message.findFirst({ where: { id: lu.rappelMessageId, tenantId }, select: { statut: true } })
            : null;
          if (!rappel || rappel.statut !== StatutMessage.ENVOYE || !lu.rappelEnvoyeLe) {
            throw new ConflictException('Le rappel n’est pas constaté envoyé · le dossier ne peut pas être supprimé.');
          }
          // Rien d'un autre dossier ne doit viser celui-ci (groupe, abonnement) · lu une seconde fois, dans la transaction.
          const visesParAilleurs =
            (await tx.tenant.count({ where: { OR: [{ dossierMereId: tenantId }, { dossierCombinaisonId: tenantId }] } })) +
            (await tx.abonnementCabinet.count({ where: { cabinetId: tenantId } }));
          if (visesParAilleurs > 0) {
            throw new ConflictException('Ce dossier est visé par un groupe ou un abonnement · il n’est pas supprimable.');
          }

          const tenant = await tx.tenant.findFirst({ where: { id: tenantId }, select: { createdAt: true } });
          const bilan = await purgerDossier(tx, tenantId);
          await tx.dossierEssaiSupprime.create({
            data: {
              ancienTenantId: tenantId,
              creeLe: tenant?.createdAt ?? (verdict.termeLe as Date),
              termeLe: verdict.termeLe as Date,
              rappelEnvoyeLe: lu.rappelEnvoyeLe,
              supprimeLe: maintenant,
              parOperateur: operateur.email,
              nombreUtilisateurs: lu.nombreUtilisateurs,
              nombreExercices: lu.nombreExercices,
              nombreEcritures: lu.nombreEcritures,
              nombreLignesSupprimees: bilan.total,
            },
          });
          this.logger.log(
            `Dossier d'essai supprimé · ${tenantId} · ${bilan.total} lignes · par ${operateur.email} · jour ${jourDeKinshasa(maintenant).toISOString().slice(0, 10)}`,
          );
          return {
            supprime: true,
            tenantId,
            nombreUtilisateurs: lu.nombreUtilisateurs,
            nombreExercices: lu.nombreExercices,
            nombreEcritures: lu.nombreEcritures,
            nombreLignesSupprimees: bilan.total,
          };
        },
        OPTIONS_SUPPRESSION,
      ),
    );
  }

  /** Le refus, en clair · jamais une donnée du client. */
  private motifDeRefus(v: VerdictEssai, lu: DossierLu): string {
    switch (v.etat) {
      case 'NON_CONCERNE':
        return `Ce dossier n’est pas concerné par la suppression des essais échus · ${v.motif ?? 'motif non précisé'}`;
      case 'EN_COURS':
        return 'L’essai de ce dossier court encore · il n’est pas supprimable.';
      case 'RAPPEL_A_ENVOYER':
        return 'Le rappel n’est pas parti · il doit précéder la suppression d’au moins trente jours.';
      default:
        return lu.rappelEnvoyeLe && v.supprimableLe
          ? `Pas avant le ${v.supprimableLe.toISOString().slice(0, 10)} · conservation de cent quatre-vingts jours après le terme et préavis de trente jours après le rappel.`
          : 'Le dossier n’est pas encore supprimable.';
    }
  }
}
