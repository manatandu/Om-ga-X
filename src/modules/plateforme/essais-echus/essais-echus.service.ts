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
import { causeDeLException, causeEchecEnvoi, CauseEchecEnvoi, LIBELLES_CAUSE_ECHEC } from './cause-echec-envoi';
import {
  dateDeSuppression,
  debutDeLaFenetreDeRappel,
  etatDeLEssai,
  FaitsDossierEssai,
  JOURS_CONSERVATION_ESSAI,
  JOURS_FENETRE_RAPPEL,
  JOURS_RAPPEL_AVANT_SUPPRESSION,
  termeDeLaLicence,
  VerdictEssai,
} from './essais-echus';
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
 * L'ÉDITEUR NE VOIT JAMAIS LES INFORMATIONS D'UN CLIENT (CLAUDE.md § 8) · la liste rend
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
  /**
   * Le motif en clair quand ce n'est pas un envoi · écrit par OmegaX, JAMAIS le
   * texte du transport (qui porte l'adresse du client), seulement sa catégorie.
   */
  detail: string | null;
  /** La catégorie de l'échec d'envoi, quand il y en a un (`cause-echec-envoi.ts`). */
  cause?: CauseEchecEnvoi | null;
}

export interface LigneEssaiEchu {
  tenantId: string;
  etat: VerdictEssai['etat'];
  termeLe: string | null;
  conserveJusquAu: string | null;
  supprimableLe: string | null;
  rappelDepuisLe: string | null;
  /**
   * `causeEchec` est une CATÉGORIE, jamais le texte de l'erreur · celui-ci cite
   * l'adresse du client, que l'éditeur ne voit pas (CLAUDE.md § 8).
   */
  rappel: { misEnFileLe: string; envoyeLe: string | null; statutCourrier: StatutMessage | null; causeEchec: CauseEchecEnvoi | null } | null;
  nombreUtilisateurs: number;
  nombreExercices: number;
  nombreEcritures: number;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Minuit à Kinshasa est 23 h UTC la veille (UTC+1, sans heure d'été · `common/echeance.ts`). */
const DECALAGE_KINSHASA_MS = 60 * 60 * 1000;

/** Un rappel mis en file depuis plus de ceci sans message est celui d'un processus tombé. */
const DELAI_RAPPEL_ORPHELIN_MS = 15 * 60_000;

/** Une page de candidats lus d'un coup (dix requêtes par page, `lire`). */
const PAGE_CANDIDATS = PLAFOND_LISTE_CONSOLE;

/**
 * Rappels tentés par appel · cinquante, convention d'OmegaX. Les envois partent
 * l'un après l'autre (un message, puis sa ligne de suivi) · cinquante tiennent
 * dans le délai d'une requête même sur un serveur de messagerie lent.
 */
export const RAPPELS_PAR_APPEL = 50;

/**
 * Aucun rappel n'est dû avant le terme + 121 jours (180 + 1 - 60). Les essais
 * plus récents ne sont pas lus par l'envoi · un jour de marge pour le fuseau.
 */
const JOURS_AVANT_LE_PREMIER_RAPPEL = JOURS_CONSERVATION_ESSAI + 1 - (JOURS_RAPPEL_AVANT_SUPPRESSION + JOURS_FENETRE_RAPPEL) - 1;

/** Le dossier entier à purger peut être long · borne de la transaction. */
const OPTIONS_SUPPRESSION = { maxWait: 10_000, timeout: 120_000 };

interface DossierLu {
  faits: FaitsDossierEssai;
  nombreUtilisateurs: number;
  nombreExercices: number;
  nombreEcritures: number;
  rappelId: string | null;
  /** Le terme que le rappel lu annonçait · toujours celui de la licence courante (voir `lire`). */
  rappelTermeLe: Date | null;
  rappelMessageId: string | null;
  rappelMisEnFileLe: Date | null;
  rappelEnvoyeLe: Date | null;
}

type Lecteur = PrismaService | Prisma.TransactionClient;

/** Un message en file, pas parti · sa catégorie d'échec s'il en a une, jamais le texte du transport. */
function enFile(tenantId: string, statut: StatutMessage, erreur: string | null): ResultatRappel {
  const cause = causeEchecEnvoi(erreur);
  return {
    tenantId,
    issue: 'EN_FILE',
    detail: `Le message est ${statut}${cause ? ` (${LIBELLES_CAUSE_ECHEC[cause]})` : ''} · il sera retenté à la prochaine demande.`,
    cause,
  };
}

@Injectable()
export class EssaisEchusService {
  private readonly logger = new Logger(EssaisEchusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courrier: CourrierService,
  ) {}

  /**
   * UNE PAGE DE CANDIDATS, PAR LA CLÉ (échéance, dossier) · les dossiers dont la
   * licence est un essai de trente jours échu (même durée et même tolérance que
   * `estUnDossierDEssai`, qui reste la règle appliquée ensuite en code), les
   * identifiants seulement.
   *
   * CE QUI N'EST PAS CONCERNÉ ET SE LIT EN BASE EST ÉCARTÉ EN SQL · licence
   * suspendue, vitrine, mère ou cellule d'un groupe, dossier de combinaison,
   * tiers de cellule chez un siège, abonnement enregistré (l'éditeur, en
   * PROPRIETAIRE, l'est par le type). Une fenêtre de cinq cents candidats pris
   * sans ce tri se remplissait de dossiers non concernés et figeait la console
   * sur eux, les dossiers concernés au-delà n'étant jamais lus. Le code rejoue
   * ensuite TOUTES les règles (`etatDeLEssai`) · le filtre SQL ne fait que
   * retirer, jamais décider qu'un dossier est supprimable.
   *
   * PAR LA CLÉ, JAMAIS PAR UN DÉCALAGE · un dossier supprimé entre deux pages ne
   * décale rien (`common/lecture-par-lots.ts`).
   */
  private async pageDeCandidats(
    client: Lecteur,
    maintenant: Date,
    apres: { dateExpiration: Date; tenantId: string } | null,
    echuAvant: Date | null,
  ): Promise<{ tenantId: string; dateExpiration: Date }[]> {
    const secondes = JOURS_ESSAI * 86_400;
    const borneEchu = echuAvant && echuAvant.getTime() < maintenant.getTime() ? echuAvant : maintenant;
    const curseur = apres ? Prisma.sql`AND (l."dateExpiration", l."tenantId") > (${apres.dateExpiration}, ${apres.tenantId})` : Prisma.empty;
    return client.$queryRaw<{ tenantId: string; dateExpiration: Date }[]>`
      SELECT l."tenantId", l."dateExpiration" FROM "licences" l
      JOIN "tenants" t ON t."id" = l."tenantId"
      WHERE l."type" = 'ABONNEMENT'::"TypeLicence"
        AND l."statut" <> 'SUSPENDUE'::"StatutLicence"
        AND l."dateExpiration" IS NOT NULL
        AND l."dateExpiration" <= ${borneEchu}
        AND abs(extract(epoch FROM (l."dateExpiration" - l."dateDebut")) - ${secondes}) <= 60
        AND t."estDemonstration" = false
        AND t."dossierMereId" IS NULL
        AND t."dossierCombinaisonId" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "tenants" g WHERE g."dossierMereId" = t."id" OR g."dossierCombinaisonId" = t."id")
        AND NOT EXISTS (SELECT 1 FROM "tiers" x WHERE x."celluleGroupeId" = t."id")
        AND NOT EXISTS (SELECT 1 FROM "abonnements_cabinets" a WHERE a."cabinetId" = t."id")
        ${curseur}
      ORDER BY l."dateExpiration" ASC, l."tenantId" ASC
      LIMIT ${PAGE_CANDIDATS}`;
  }

  /**
   * TOUS LES CANDIDATS, PAGE PAR PAGE · chaque page est lue (`lire`) et rendue à
   * l'appelant avec son verdict, la plus ancienne échéance d'abord. L'appelant
   * dit s'il faut continuer · la console lit tout pour compter, les rappels
   * aussi (ce qui reste dû est DIT, jamais tu).
   */
  private async parcourir(
    maintenant: Date,
    visiter: (dossiers: { tenantId: string; lu: DossierLu; verdict: VerdictEssai }[]) => Promise<void>,
    echuAvant: Date | null = null,
  ): Promise<number> {
    let apres: { dateExpiration: Date; tenantId: string } | null = null;
    let examines = 0;
    for (;;) {
      const page = await this.pageDeCandidats(this.prisma, maintenant, apres, echuAvant);
      examines += page.length;
      const lus = await this.lire(this.prisma, page.map((c) => c.tenantId));
      const dossiers: { tenantId: string; lu: DossierLu; verdict: VerdictEssai }[] = [];
      for (const c of page) {
        const lu = lus.get(c.tenantId);
        if (lu) dossiers.push({ tenantId: c.tenantId, lu, verdict: etatDeLEssai(lu.faits, maintenant) });
      }
      await visiter(dossiers);
      if (page.length < PAGE_CANDIDATS) return examines;
      const dernier = page[page.length - 1];
      apres = { dateExpiration: dernier.dateExpiration, tenantId: dernier.tenantId };
    }
  }

  /**
   * Lit, pour chaque dossier, tout ce que le calendrier et les refus exigent ·
   * par lots, une requête par table pour tous les dossiers (jamais une par
   * dossier). Appelé hors cloisonnement par ses appelants.
   */
  private async lire(client: Lecteur, ids: string[]): Promise<Map<string, DossierLu>> {
    if (ids.length === 0) return new Map();
    const [tenants, licences, abonnements, mereOuCellule, tiersCellule, preuves, comptesUtilisateurs, rappels, utilisateurs, exercices, ecritures] = await Promise.all([
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
      // LA PREUVE DE L'INSCRIPTION · le courriel de l'inscription en libre-service
      // porte `origineId` = le dossier quand il part à la création, mais le RENVOI
      // (auth.service, titulaire qui n'a rien reçu) l'écrit avec l'identifiant de
      // l'UTILISATEUR, et un premier envoi échoué n'écrit rien du tout. Les deux
      // formes prouvent la même porte · seul le renvoi existe pour un dossier
      // dont le premier courriel n'est pas parti.
      client.message.findMany({
        where: { tenantId: { in: ids }, origine: ORIGINE_INSCRIPTION_ESSAI },
        select: { tenantId: true, origineId: true },
      }),
      client.user.findMany({ where: { tenantId: { in: ids } }, select: { id: true, tenantId: true } }),
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
    const utilisateurDe = new Map(comptesUtilisateurs.map((u) => [u.id, u.tenantId]));
    const inscrits = new Set(
      preuves.filter((p) => p.origineId === p.tenantId || (p.origineId !== null && utilisateurDe.get(p.origineId) === p.tenantId)).map((p) => p.tenantId),
    );
    // UN RAPPEL PAR TERME · seul celui du terme de la licence COURANTE est lu. Un
    // essai redonné (terme nouveau) laisse le rappel de l'ancien terme dans la
    // table, et il n'y vaut pas préavis (`rappelDuTermeCourant`).
    const rappelDe = new Map<string, (typeof rappels)[number]>();
    for (const r of rappels) {
      const l = licenceDe.get(r.cabinetId);
      if (!l?.dateExpiration) continue;
      if (r.termeLe.getTime() === termeDeLaLicence(l.dateExpiration).getTime()) rappelDe.set(r.cabinetId, r);
    }

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
          rappel: r ? { envoyeLe: r.envoyeLe, termeLe: r.termeLe } : null,
        },
        nombreUtilisateurs: nUtilisateurs.get(t.id) ?? 0,
        nombreExercices: nExercices.get(t.id) ?? 0,
        nombreEcritures: nEcritures.get(t.id) ?? 0,
        rappelId: r?.id ?? null,
        rappelTermeLe: r?.termeLe ?? null,
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
   *
   * TOUT EST LU, PAR PAGES, ET COMPTÉ · `total`, `aRappeler` et `supprimables`
   * portent sur TOUS les dossiers concernés ; seules les lignes rendues sont une
   * tranche (les plus anciennes échéances d'abord, § 8 bis), et `tronque` le dit.
   * Le bouton des rappels se règle sur `aRappeler`, jamais sur la tranche · un
   * rappel dû au-delà des lignes affichées partait sinon jamais.
   */
  async lister(maintenant: Date = new Date()) {
    return horsCloisonnement('console · dossiers d’essai échus', async () => {
      const gardes: { tenantId: string; lu: DossierLu; verdict: VerdictEssai }[] = [];
      let total = 0;
      let aRappeler = 0;
      let supprimables = 0;
      await this.parcourir(maintenant, async (dossiers) => {
        for (const d of dossiers) {
          if (d.verdict.etat === 'NON_CONCERNE' || d.verdict.etat === 'EN_COURS') continue;
          total += 1;
          if (d.verdict.etat === 'RAPPEL_A_ENVOYER') aRappeler += 1;
          if (d.verdict.etat === 'SUPPRIMABLE') supprimables += 1;
          if (gardes.length < PLAFOND_LISTE_CONSOLE) gardes.push(d);
        }
      });
      const statuts = await this.statutsDesRappels(gardes);
      const lignes: LigneEssaiEchu[] = gardes.map(({ tenantId, lu: l, verdict: v }) => {
        const message = l.rappelMessageId ? statuts.get(l.rappelMessageId) ?? null : null;
        return {
          tenantId,
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
                causeEchec: causeEchecEnvoi(message?.erreur),
              }
            : null,
          nombreUtilisateurs: l.nombreUtilisateurs,
          nombreExercices: l.nombreExercices,
          nombreEcritures: l.nombreEcritures,
        };
      });
      return { essais: lignes, ...tranche(lignes.length, total), aRappeler, supprimables };
    });
  }

  /**
   * L'état courant des messages de rappel (statut et erreur seulement, jamais le
   * corps ni l'adresse). L'erreur est lue pour être CATÉGORISÉE, elle ne quitte
   * pas le serveur.
   */
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
   * · TOUS LES DOSSIERS DUS SONT LUS, CINQUANTE SONT TENTÉS PAR APPEL · les plus
   *   anciennes échéances d'abord ; le reste est compté (`restants`), jamais tu,
   *   et l'appel suivant le prend.
   */
  async envoyerRappels(operateur: { userId: string; email: string }, maintenant: Date = new Date()) {
    if (!this.courrier.etatDuTransport().configure) {
      throw new ConflictException(
        'Aucune messagerie n’est configurée · un rappel qui ne part pas ne vaut pas préavis. Configurez la messagerie, puis recommencez.',
      );
    }
    return horsCloisonnement('console · rappels de suppression des dossiers d’essai échus', async () => {
      const resultats: ResultatRappel[] = [];
      let restants = 0;
      // Aucun rappel n'est dû avant le cent vingt et unième jour après le terme
      // (`debutDeLaFenetreDeRappel`) · les essais plus récents ne sont pas lus. Un
      // jour de marge pour le fuseau, le calendrier exact étant rejoué ensuite.
      const echuAvant = new Date(maintenant.getTime() - JOURS_AVANT_LE_PREMIER_RAPPEL * 86_400_000);
      const examines = await this.parcourir(
        maintenant,
        async (dossiers) => {
          for (const { tenantId: id, lu: l, verdict: v } of dossiers) {
            // Ni un dossier hors calendrier, ni un dossier dont le rappel est déjà
            // parti (état ECHU_CONSERVE ou SUPPRIMABLE avec envoyeLe).
            if (v.etat !== 'RAPPEL_A_ENVOYER') continue;
            // CINQUANTE PAR APPEL · les envois sont en série (un serveur de
            // messagerie lent tiendrait la requête au-delà de son délai) ; le reste
            // est COMPTÉ et dit, l'appel suivant le prend, plus ancien d'abord.
            if (resultats.length >= RAPPELS_PAR_APPEL) {
              restants += 1;
              continue;
            }
            try {
              resultats.push(await this.rappelerUn(id, l, v, operateur, maintenant));
            } catch (erreur) {
              if (erreur instanceof ConflictException) {
                // `retenter` · un autre geste envoie ce message à l'instant.
                resultats.push({ tenantId: id, issue: 'EN_COURS', detail: 'Un envoi est déjà en cours pour ce dossier.', cause: null });
                continue;
              }
              // Ni le message de l'erreur ni sa pile · le refus de la file cite
              // l'adresse de l'administrateur. Le journal du serveur reçoit le NOM de
              // l'erreur et sa catégorie, la console la catégorie.
              const cause = causeDeLException(erreur);
              const nom = erreur instanceof Error ? erreur.name : typeof erreur;
              this.logger.error(`Rappel de suppression · échec pour le dossier ${id} · ${nom} · ${LIBELLES_CAUSE_ECHEC[cause]}`);
              resultats.push({ tenantId: id, issue: 'ECHEC', detail: `L’envoi du rappel a échoué · ${LIBELLES_CAUSE_ECHEC[cause]}.`, cause });
            }
          }
        },
        echuAvant,
      );
      const compte = (i: IssueRappel) => resultats.filter((r) => r.issue === i).length;
      return {
        resultats,
        envoyes: compte('ENVOYE') + compte('DEJA_ENVOYE'),
        enFile: compte('EN_FILE'),
        echecs: compte('ECHEC') + compte('SANS_ADMINISTRATEUR'),
        // TOUS les candidats ont été lus · `restants` compte les rappels dus que la
        // borne de cet appel n'a pas tentés, jamais un silence sur la suite.
        examines,
        restants,
        parAppel: RAPPELS_PAR_APPEL,
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

    // 3. Réservation avant l'envoi · la clé unique (dossier, terme) ferme le doublon.
    // `supprimableLe` est la date que le courriel ANNONCE · un minimum, la date
    // réelle étant relue sur l'envoi constaté (voir le schéma).
    const termeLe = verdict.termeLe as Date;
    const supprimableLe = dateDeSuppression(termeLe, maintenant);
    let reservation: { id: string };
    try {
      reservation = await this.prisma.rappelSuppressionEssai.create({
        data: { cabinetId: tenantId, termeLe, messageId: '', supprimableLe, parOperateur: operateur.email },
        select: { id: true },
      });
    } catch (erreur) {
      if ((erreur as { code?: string })?.code === 'P2002') {
        return { tenantId, issue: 'EN_COURS', detail: 'Un autre envoi a réservé ce dossier à l’instant.' };
      }
      throw erreur;
    }

    try {
      // 4. Un message déjà écrit pour ce dossier ET CE TERME (processus tombé après
      // l'écriture) est ADOPTÉ. Le rappel d'un terme ancien, écrit avant l'ouverture
      // de la fenêtre du terme courant, ne l'est jamais · il annonçait une autre date.
      // Le message qu'une AUTRE ligne de suivi tient (le rappel d'un autre terme)
      // ne l'est jamais non plus, quelle que soit sa date · rejeu sur vraie base du
      // 2026-10-21, un essai redonné avec un terme déjà échu ouvrait sa fenêtre
      // AVANT le rappel de l'ancien terme, qui était adopté pour « parti » sans
      // qu'aucun courriel n'annonce la date nouvelle.
      const ouvertureFenetre = new Date(debutDeLaFenetreDeRappel(termeLe).getTime() - DECALAGE_KINSHASA_MS);
      const tenus = await this.prisma.rappelSuppressionEssai.findMany({
        where: { cabinetId: tenantId, id: { not: reservation.id }, messageId: { not: '' } },
        select: { messageId: true },
      });
      const existant = await this.prisma.message.findFirst({
        where: {
          tenantId,
          origine: ORIGINE_RAPPEL_SUPPRESSION_ESSAI,
          origineId: tenantId,
          statut: { not: StatutMessage.ABANDONNE },
          createdAt: { gte: ouvertureFenetre },
          id: { notIn: tenus.map((t) => t.messageId) },
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
        const avis = avisRappelSuppression({ termeLe, supprimableLe });
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
      return enFile(tenantId, statut, erreur);
    } catch (echec) {
      // L'envoi n'a pas pu s'écrire (adresse inutilisable, base) · la réservation
      // est LIBÉRÉE pour qu'un nouvel appel puisse réessayer, et l'erreur remonte.
      await this.prisma.rappelSuppressionEssai
        .deleteMany({ where: { id: reservation.id, messageId: '', envoyeLe: null } })
        .catch((e) => this.logger.error(`Rappel de suppression · réservation du dossier ${tenantId} non libérée · ${e instanceof Error ? e.name : typeof e}`));
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
      const cause = causeEchecEnvoi(erreur);
      return {
        tenantId,
        issue: 'ECHEC',
        detail: `Le message est abandonné après plusieurs essais (${cause ? LIBELLES_CAUSE_ECHEC[cause] : 'cause non gardée'}) · la réservation est levée, recommencez.`,
        cause,
      };
    }
    if (statut !== StatutMessage.ENVOYE) {
      const r = await this.courrier.retenter(tenantId, messageId);
      statut = r.statut;
      erreur = r.erreur;
      envoyeAt = statut === StatutMessage.ENVOYE ? maintenant : envoyeAt;
    }
    if (statut === StatutMessage.ENVOYE) {
      // LA DATE ANNONCÉE N'EST QU'UN MINIMUM · `supprimableLe` reste celle que le
      // courriel a dite (calculée à la réservation) ; parti un autre jour que celui
      // où il a été écrit, le message repousse la date RÉELLE, que le calendrier
      // relit sur `envoyeLe` (trente jours pleins après le jour de l'envoi). Sens
      // sûr · jamais supprimable avant la date annoncée, parfois après.
      await this.prisma.rappelSuppressionEssai.update({ where: { id: rappelId }, data: { envoyeLe: envoyeAt ?? maintenant } });
      return { tenantId, issue: 'ENVOYE', detail: null };
    }
    return enFile(tenantId, statut, erreur);
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
   *   dossier, verrou de sa ligne (`FOR UPDATE`, qui retient aussi toute
   *   insertion concurrente par clé étrangère) et verrou de sa LICENCE (qu'une
   *   prolongation écrit seule), puis le calendrier est rejoué sur
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
          // LA LICENCE SOUS VERROU AUSSI · `modifierLicence` (prolongation, essai
          // redonné, encaissement) écrit la ligne de licence sans toucher celle du
          // dossier · sans ce verrou, une prolongation validée pendant la purge
          // n'était pas vue par la lecture qui suit, et un dossier redevenu actif
          // était supprimé. Une prolongation concurrente ATTEND ici, et l'état est
          // relu après elle (la lecture qui suit voit ce qu'elle a validé).
          await tx.$queryRaw`SELECT 1 FROM "licences" WHERE "tenantId" = ${tenantId} FOR UPDATE`;

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
          // Le rappel doit être celui du terme COURANT · un essai redonné entre-temps
          // a un terme nouveau, et le rappel de l'ancien n'a prévenu de rien.
          if (!lu.rappelTermeLe || lu.rappelTermeLe.getTime() !== (verdict.termeLe as Date).getTime()) {
            throw new ConflictException('Le rappel parti ne correspond pas au terme courant de l’essai · un nouveau rappel doit partir avant la suppression.');
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
