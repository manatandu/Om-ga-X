import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { libelleReference, referencesVers, refuserSiReferences, reporterReferences } from '../../common/suppression/references';
import { coordonneesAComblement, motifRefusFusionTiers } from './fusion-tiers';
import {
  numeroIndividuelAligne,
  panoplieDuTiers,
  racineCollectif,
  motifRefusNumeroChoisi,
  prochainNumeroIndividuel,
  rangSousRacine,
  type RolePanoplie,
} from './collectifs-tiers';
import { PrismaService } from '../../common/prisma.service';
import { ClasseCompte, ConditionEcheance, Prisma, Referentiel, TypeEcheance, TypeTiers } from '@prisma/client';
import { CreerTiersDto, ModifierTiersDto, RattacherCompteDto } from './dto/tiers.dto';
import {
  CreerModeleReglementDto,
  ModifierModeleReglementDto,
  CreerEcheanceReglementDto,
  CalculerEcheancesDto,
} from './dto/modele-reglement.dto';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { dateSaisieOuEffacement } from '../tenant/date-effacable';
import { motifRefusPeriodeAutorisationDebits } from './periode-autorisation-debits';

/**
 * Tiers (cf. docs/plan-de-construction.md §3.2) : Client/Fournisseur/Salarié/
 * Autre, avec un ou plusieurs comptes généraux rattachés (dont un Principal)
 * et un modèle de règlement optionnel. Dépend du Lettrage déjà livré · le
 * suivi par tiers n'a de sens que parce que le solde réel (mouvements non
 * lettrés) est calculable.
 */
/** Les types qui ont une panoplie dans un référentiel au moins (collectifs-tiers.ts). */
const TYPES_A_PANOPLIE: TypeTiers[] = [TypeTiers.FOURNISSEUR, TypeTiers.CLIENT, TypeTiers.ADHERENT];

/** Tiers traités par appel de la complétion du dossier · voir `completerPanoplies`. */
export const TRANCHE_PANOPLIES = 100;

export interface PanoplieTiers {
  /** Le compte principal CRÉÉ par cet appel · nul s'il existait déjà ou n'a pas pu naître. */
  principal: { id: string; numero: string; collectif: string } | null;
  crees: { role: RolePanoplie; numero: string; collectif: string }[];
  dejaPresents: number;
  impossibles: { collectif: string; motif: string }[];
}

export interface NumeroPropose {
  /** Nul quand rien ne peut s'ouvrir · `motif` dit pourquoi. */
  numero: string | null;
  collectif: string | null;
  longueur: number;
  motif: string | null;
}

export interface CompletionPanoplies {
  tiersLus: number;
  comptesCrees: number;
  impossibles: { tiers: string; collectif: string; motif: string }[];
  /** Curseur de la tranche suivante · nul quand tout le dossier est lu. */
  suivant: string | null;
}

/**
 * UN CONFLIT D'UNICITÉ SE DIT · une autre saisie a pris le numéro ou le code
 * entre la lecture et l'écriture. Le 500 brut laissait croire à une panne.
 */
function conflitDeNumeroNomme(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const cible = JSON.stringify(e.meta?.target ?? '');
    throw new ConflictException(
      cible.includes('numero')
        ? "Un numéro de compte de la panoplie vient d'être ouvert par une autre saisie · relancez la demande."
        : "Ce tiers vient d'être créé par une autre saisie · relancez la demande.",
    );
  }
  throw e;
}

@Injectable()
export class TiersService {
  constructor(private readonly prisma: PrismaService) {}

  private async trouver(tenantId: string, tiersId: string) {
    const tiers = await this.prisma.tiers.findFirst({
      where: { id: tiersId, tenantId },
      include: {
        modeleReglement: true,
        // orderBy explicite : sans lui, Postgres ne garantit aucun ordre
        // stable, et l'ordre peut visiblement changer après un simple UPDATE
        // (ex. bascule du compte Principal) · repéré en testant le bouton
        // "Détacher" dans l'UI (la ligne visée changeait de position).
        comptesRattaches: { include: { compte: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!tiers) {
      throw new NotFoundException('Tiers introuvable pour ce tenant');
    }
    return tiers;
  }

  async lister(tenantId: string, filtres: { type?: TypeTiers; recherche?: string; actifsSeuls?: boolean }) {
    const where: Prisma.TiersWhereInput = {
      tenantId,
      ...(filtres.type ? { type: filtres.type } : {}),
      ...(filtres.actifsSeuls ? { estActif: true } : {}),
      ...(filtres.recherche
        ? {
            OR: [
              { code: { contains: filtres.recherche, mode: 'insensitive' } },
              { nom: { contains: filtres.recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.tiers.findMany({
      where,
      include: {
        modeleReglement: true,
        // orderBy explicite : sans lui, Postgres ne garantit aucun ordre
        // stable, et l'ordre peut visiblement changer après un simple UPDATE
        // (ex. bascule du compte Principal) · repéré en testant le bouton
        // "Détacher" dans l'UI (la ligne visée changeait de position).
        comptesRattaches: { include: { compte: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async obtenir(tenantId: string, tiersId: string) {
    return this.trouver(tenantId, tiersId);
  }

  async creer(tenantId: string, dto: CreerTiersDto) {
    await this.refuserAdherentHorsSycebnl(tenantId, dto.type);
    const existant = await this.prisma.tiers.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
    if (existant) {
      throw new ConflictException(`Le tiers ${dto.code} existe déjà pour ce tenant`);
    }
    if (dto.modeleReglementId) {
      await this.trouverModeleReglement(tenantId, dto.modeleReglementId);
    }
    if (dto.celluleGroupeId) {
      await this.exigerMemeGroupe(tenantId, dto.celluleGroupeId);
    }
    const { creerCompteIndividuel, numeroCompte, dateEffetAutorisationDebits, dateRevocationAutorisationDebits, ...reste } = dto;
    // UN NUMÉRO CHOISI SANS COMPTE À OUVRIR NE SE PERD PAS EN SILENCE · le
    // cabinet croirait son compte ouvert sous ce numéro.
    if (numeroCompte !== undefined && creerCompteIndividuel === false) {
      throw new BadRequestException(
        "Un numéro de compte choisi suppose d'ouvrir les comptes du tiers · cochez « Ouvrir ses comptes », ou laissez le numéro vide.",
      );
    }
    // Les deux dates de l'autorisation aux débits passent par la même lecture
    // que les dates du régime de TVA du dossier · une chaîne AAAA-MM-JJ n'est
    // pas un DateTime pour Prisma, et `new Date` reporterait en silence un
    // jour absent du calendrier.
    const periode = {
      dateEffetAutorisationDebits: dateSaisieOuEffacement(dateEffetAutorisationDebits),
      dateRevocationAutorisationDebits: dateSaisieOuEffacement(dateRevocationAutorisationDebits),
    };
    const motif = motifRefusPeriodeAutorisationDebits(
      periode.dateEffetAutorisationDebits,
      periode.dateRevocationAutorisationDebits,
    );
    if (motif) throw new BadRequestException(motif);
    const donnees = { ...reste, ...periode };
    // Le compte naît dans la même transaction que le tiers · un tiers créé
    // sans le compte qu'on lui annonce serait une fiche qui ne recevrait
    // aucune écriture, et personne ne s'en apercevrait avant la relance.
    return transactionJournalisee(this.prisma, async (tx) => {
      const tiers = await tx.tiers.create({ data: { ...donnees, tenantId } });
      const panoplie =
        creerCompteIndividuel === false
          ? null
          : await this.poserPanoplie(tx, tenantId, tiers, { silencieux: true, numeroPrincipal: numeroCompte });
      return { ...tiers, compteIndividuel: panoplie?.principal ?? null, panoplie };
    }).catch(conflitDeNumeroNomme);
  }

  /**
   * LE NUMÉRO QU'OMEGAX PROPOSE pour le compte principal d'un tiers à créer ·
   * le premier libre sous le collectif de son type, à la longueur du
   * dossier, le même que la création prendrait sans numéro choisi. Il n'est
   * PAS réservé · la création le rejuge sous verrou. Un type sans panoplie,
   * ou un collectif absent ou en sommeil, rend `numero: null` avec le motif,
   * jamais un numéro que la création refuserait.
   */
  async numeroPropose(tenantId: string, type: TypeTiers): Promise<NumeroPropose> {
    const { referentiel, longueurCompte } = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { referentiel: true, longueurCompte: true },
    });
    const panoplie = panoplieDuTiers(referentiel, type);
    if (panoplie.length === 0) {
      return {
        numero: null,
        collectif: null,
        longueur: longueurCompte,
        motif: "Ce type de tiers n'a pas de compte collectif proposé · son compte se rattache à la main.",
      };
    }
    const collectif = panoplie[0].collectif;
    const compteCollectif = await this.prisma.compte.findFirst({
      where: { tenantId, numero: collectif },
      select: { estActif: true },
    });
    if (!compteCollectif?.estActif) {
      return {
        numero: null,
        collectif,
        longueur: longueurCompte,
        motif: `Le compte collectif ${collectif} n'existe pas ou est en sommeil dans ce dossier.`,
      };
    }
    const racine = racineCollectif(collectif);
    const existants = await this.prisma.compte.findMany({
      where: { tenantId, numero: { startsWith: racine } },
      select: { numero: true },
    });
    const numero = prochainNumeroIndividuel(racine, longueurCompte, [collectif, ...existants.map((c) => c.numero)]);
    return {
      numero,
      collectif,
      longueur: longueurCompte,
      motif: numero
        ? null
        : `Plus aucun numéro libre sous le collectif ${collectif} à ${longueurCompte} chiffres · allongez les numéros ` +
          'de compte (Structure > Paramètres du dossier).',
    };
  }

  /**
   * COMPLÈTE LA PANOPLIE D'UN TIERS (collectifs-tiers.ts) · les tiers nés
   * avant elle, ou sans leurs comptes, reçoivent ceux qui leur manquent, et
   * ceux qu'ils ont restent tels quels. Rien d'automatique sur un dossier
   * existant (décision de Manasse du 2026-10-09, « Bouton Compléter ») · le
   * cabinet le demande. Refuse en le disant quand le type n'a pas de panoplie.
   */
  async completerPanoplie(tenantId: string, tiersId: string): Promise<PanoplieTiers> {
    const tiers = await this.trouver(tenantId, tiersId);
    const resultat = await transactionJournalisee(this.prisma, (tx) =>
      this.poserPanoplie(tx, tenantId, tiers, { silencieux: false }),
    ).catch(conflitDeNumeroNomme);
    return resultat as PanoplieTiers;
  }

  /**
   * LA MÊME CHOSE POUR TOUS LES TIERS DU DOSSIER, PAR TRANCHES · cent tiers
   * par appel, une transaction par tiers, le curseur rendu pour l'appel
   * suivant. Un dossier de milliers de tiers dépasserait sinon la minute que
   * le relais du site laisse à une requête, et un tiers qui ne peut pas
   * recevoir un compte (collectif en sommeil, plus de numéro libre)
   * n'empêche pas les autres · il est nommé.
   */
  async completerPanoplies(tenantId: string, apres?: string): Promise<CompletionPanoplies> {
    // LE CURSEUR EST UNE BORNE, PAS UNE LIGNE · `pageApres` pose le curseur de
    // Prisma sur le dernier tiers lu, et un tiers supprimé entre deux appels
    // rendait une tranche VIDE, lue comme « tout le dossier est fait ». Les
    // tiers en sommeil ne reçoivent rien.
    const tranche = await this.prisma.tiers.findMany({
      where: { tenantId, type: { in: TYPES_A_PANOPLIE }, estActif: true, ...(apres ? { id: { gt: apres } } : {}) },
      select: { id: true, type: true, nom: true, code: true },
      orderBy: { id: 'asc' },
      take: TRANCHE_PANOPLIES,
    });
    let comptesCrees = 0;
    const impossibles: CompletionPanoplies['impossibles'] = [];
    for (const tiers of tranche) {
      // UN TIERS QUI ÉCHOUE N'ARRÊTE PAS LA TRANCHE · sa transaction est
      // défaite, il est nommé avec son motif, et les suivants se complètent.
      let r: PanoplieTiers | null;
      try {
        r = await transactionJournalisee(this.prisma, (tx) => this.poserPanoplie(tx, tenantId, tiers, { silencieux: true }));
      } catch (e) {
        let motif = 'Échec imprévu · relancez la complétion de ce tiers depuis sa fiche.';
        try {
          conflitDeNumeroNomme(e);
        } catch (nomme) {
          if (nomme instanceof HttpException) motif = nomme.message;
        }
        impossibles.push({ tiers: tiers.code, collectif: '', motif });
        continue;
      }
      if (!r) continue;
      comptesCrees += r.crees.length;
      for (const i of r.impossibles) impossibles.push({ tiers: tiers.code, ...i });
    }
    const suivant = tranche.length === TRANCHE_PANOPLIES ? tranche[tranche.length - 1].id : null;
    return { tiersLus: tranche.length, comptesCrees, impossibles, suivant };
  }

  /**
   * LES COMPTES DU TIERS SOUS LES COLLECTIFS DE SA PANOPLIE · pour chaque
   * rôle qui n'a pas encore son compte, le numéro de même rang que le
   * principal s'il est libre, sinon le suivant libre, l'intitulé du tiers
   * (suivi du rôle hors du principal), les réglages du collectif (classe,
   * lettrage, report à-nouveau) et le lien au collectif · c'est ce lien qui
   * fond le compte sur son collectif à la balance générale et qui fait
   * refuser la saisie manuelle sur le collectif (`EcritureService.
   * verifierComptesCollectifs`). Le premier rôle est rattaché comme
   * principal.
   *
   * Un rôle est déjà tenu quand un compte rattaché au tiers vit sous sa
   * racine, autre que le collectif lui-même ; le principal, dès qu'un compte
   * principal est rattaché. En mode `silencieux` (création d'un tiers,
   * complétion du dossier), un type sans panoplie rend null.
   */
  private async poserPanoplie(
    tx: Prisma.TransactionClient,
    tenantId: string,
    tiers: { id: string; type: TypeTiers; nom: string; code: string },
    options: { silencieux: boolean; numeroPrincipal?: string },
  ): Promise<PanoplieTiers | null> {
    const { referentiel, longueurCompte } = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { referentiel: true, longueurCompte: true },
    });
    const panoplie = panoplieDuTiers(referentiel, tiers.type);
    if (panoplie.length === 0) {
      if (options.silencieux && options.numeroPrincipal === undefined) return null;
      throw new BadRequestException(
        'Ce type de tiers n\'a pas de compte collectif proposé · un salarié passe par le 422 de la paie, un tiers « autre » ' +
          'peut être débiteur ou créditeur. Rattachez son compte à la main.',
      );
    }
    // UN NUMÉRO SE CHOISIT SOUS VERROU · deux complétions du même dossier, ou
    // une complétion et une création de tiers, lisaient les mêmes numéros
    // libres et la seconde tombait sur la contrainte d'unicité.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`panoplie:${tenantId}`}))`;
    const rattaches = await tx.tiersCompte.findMany({
      where: { tiersId: tiers.id },
      select: { id: true, estPrincipal: true, compte: { select: { numero: true } } },
    });
    // LE NUMÉRO CHOISI SE JUGE AVANT TOUTE ÉCRITURE de la panoplie · ses
    // règles (collectifs-tiers.ts) ne dépendent que du dossier.
    if (options.numeroPrincipal !== undefined) {
      const motif = motifRefusNumeroChoisi(options.numeroPrincipal, panoplie[0].collectif, longueurCompte, referentiel);
      if (motif) throw new BadRequestException(motif);
    }
    const resultat: PanoplieTiers = { principal: null, crees: [], dejaPresents: 0, impossibles: [] };
    let rang: number | null = null;
    // UN PRINCIPAL POSÉ SUR LE COLLECTIF N'EST PAS UN COMPTE DU TIERS · un
    // tiers ancien rattaché au 41110000 commun recevait « déjà présent » et
    // restait sans compte à lui, quand la saisie refuse ce collectif. Il
    // reçoit son compte, qui devient le principal ; le collectif reste
    // rattaché, sans la marque.
    const principalSurCollectif = rattaches.find((r) => r.estPrincipal && r.compte.numero === panoplie[0].collectif);
    const principalExistant = principalSurCollectif ? undefined : rattaches.find((r) => r.estPrincipal);
    if (principalExistant) rang = rangSousRacine(principalExistant.compte.numero, racineCollectif(panoplie[0].collectif));

    for (const role of panoplie) {
      const racine = racineCollectif(role.collectif);
      const tenu =
        role.role === 'PRINCIPAL'
          ? !!principalExistant
          : rattaches.some((r) => r.compte.numero.startsWith(racine) && r.compte.numero !== role.collectif);
      if (tenu) {
        resultat.dejaPresents += 1;
        continue;
      }
      const collectif = await tx.compte.findFirst({ where: { tenantId, numero: role.collectif } });
      if (!collectif || !collectif.estActif) {
        resultat.impossibles.push({
          collectif: role.collectif,
          motif: `Le compte collectif ${role.collectif} n'existe pas ou est en sommeil dans ce dossier.`,
        });
        continue;
      }
      const existants = await tx.compte.findMany({
        where: { tenantId, numero: { startsWith: racine } },
        select: { numero: true },
      });
      const choisi = role.role === 'PRINCIPAL' ? options.numeroPrincipal : undefined;
      // PRIS, LE NUMÉRO CHOISI EST REFUSÉ, jamais remplacé par le suivant · le
      // cabinet a nommé ce compte, et un autre numéro passerait inaperçu.
      if (choisi !== undefined && existants.some((c) => c.numero === choisi)) {
        throw new ConflictException(
          `Le compte ${choisi} existe déjà dans ce dossier · choisissez un autre numéro, ou laissez celui qu'OmegaX propose.`,
        );
      }
      const numero =
        choisi ??
        numeroIndividuelAligne(racine, longueurCompte, rang, [role.collectif, ...existants.map((c) => c.numero)]);
      if (!numero) {
        resultat.impossibles.push({
          collectif: role.collectif,
          motif:
            `Plus aucun numéro libre sous le collectif ${role.collectif} à ${longueurCompte} chiffres · allongez les numéros ` +
            'de compte (Structure > Paramètres du dossier) ou rattachez un compte à la main.',
        });
        continue;
      }
      const compte = await tx.compte.create({
        data: {
          tenantId,
          numero,
          intitule: role.libelle ? `${tiers.nom} · ${role.libelle}` : tiers.nom,
          classe: collectif.classe,
          typeCompte: collectif.typeCompte,
          modeReportANouveau: collectif.modeReportANouveau,
          lettrable: collectif.lettrable,
          collectifId: collectif.id,
        },
      });
      const principal = role.role === 'PRINCIPAL';
      if (principal && principalSurCollectif) {
        await tx.tiersCompte.update({ where: { id: principalSurCollectif.id }, data: { estPrincipal: false } });
      }
      await tx.tiersCompte.create({ data: { tiersId: tiers.id, compteId: compte.id, estPrincipal: principal } });
      if (principal) {
        resultat.principal = { id: compte.id, numero: compte.numero, collectif: collectif.numero };
        rang = rangSousRacine(compte.numero, racine);
      }
      resultat.crees.push({ role: role.role, numero: compte.numero, collectif: collectif.numero });
    }
    if (!options.silencieux && resultat.crees.length === 0 && resultat.impossibles.length > 0) {
      throw new BadRequestException(resultat.impossibles.map((i) => i.motif).join(' '));
    }
    // UN NUMÉRO CHOISI QUI N'A PAS PU S'OUVRIR REFUSE LA CRÉATION · un tiers
    // né sans le compte qu'on lui a nommé ne recevrait aucune écriture.
    if (options.numeroPrincipal !== undefined && resultat.principal?.numero !== options.numeroPrincipal) {
      const motifs = resultat.impossibles.map((i) => i.motif).join(' ');
      throw new BadRequestException(
        motifs || `Le compte ${options.numeroPrincipal} n'a pas été ouvert · ce tiers a déjà un compte principal.`,
      );
    }
    return resultat;
  }

  /**
   * L'ADHÉRENT EST UNE NOTION DU SYCEBNL, ET LE REFUS EST CÔTÉ SERVEUR.
   *
   * Le compte 41 du SYCEBNL loge deux populations distinctes, 411 Adhérents et
   * 412 Clients-usagers ; le plan SYSCOHADA n'en connaît qu'une, ses 411
   * Clients, le 412 y portant des effets à recevoir. Masquer le type dans
   * l'écran ne suffit pas : la route resterait ouverte à un appel direct
   * (CLAUDE.md § 6).
   */
  private async refuserAdherentHorsSycebnl(tenantId: string, type?: TypeTiers) {
    if (type !== TypeTiers.ADHERENT) return;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { referentiel: true },
    });
    if (tenant.referentiel !== Referentiel.SYCEBNL) {
      throw new BadRequestException(
        "Le type « adhérent » relève du compte 411 du SYCEBNL, qui distingue les membres cotisants des " +
          'clients-usagers. Le plan SYSCOHADA ne porte que des clients : utilisez le type « client ».',
      );
    }
  }

  /**
   * SUPPRESSION D'UN TIERS. Ses rattachements de comptes lui APPARTIENNENT et
   * partent avec lui · le compte, lui, reste au plan. Mais un tiers dont un
   * compte rattaché est mouvementé est un tiers MOUVEMENTÉ (Sage) · le
   * supprimer ferait perdre à qui appartient ce compte dans la balance. Tout
   * autre usage (factures, devis, relances, circularisation, consignations)
   * refuse aussi (references.ts).
   */
  async supprimer(tenantId: string, tiersId: string) {
    const tiers = await this.prisma.tiers.findFirst({
      where: { id: tiersId, tenantId },
      include: { comptesRattaches: { select: { compteId: true } } },
    });
    if (!tiers) throw new NotFoundException('Tiers introuvable pour ce dossier.');
    const comptes = tiers.comptesRattaches.map((r) => r.compteId);
    const mouvements = comptes.length
      ? await this.prisma.ligneEcriture.count({ where: { compteId: { in: comptes }, ecriture: { tenantId } } })
      : 0;
    if (mouvements > 0) {
      throw new ConflictException(
        `Le tiers ${tiers.code} ne peut pas être supprimé · ses comptes sont mouvementés (${mouvements} ligne(s)). ` +
          'Mettez-le en sommeil pour qu’il ne soit plus proposé.',
      );
    }
    refuserSiReferences(
      `Le tiers ${tiers.code}`,
      await referencesVers(this.prisma, 'Tiers', tiers.id, tenantId, ['TiersCompte.tiersId', 'RibTiers.tiersId']),
    );
    // Ses RIB lui appartiennent comme ses rattachements · un ordre de virement
    // qui en a recopié un, lui, RETIENT le tiers (LigneOrdreVirement, compté
    // par references.ts), et la copie sur l'ordre ne dépend pas du RIB.
    await transactionJournalisee(this.prisma, async (tx) => {
      await tx.ribTiers.deleteMany({ where: { tenantId, tiersId: tiers.id } });
      await tx.tiersCompte.deleteMany({ where: { tiersId: tiers.id } });
      await tx.tiers.delete({ where: { id: tiers.id } });
    });
    return { supprime: true };
  }

  /**
   * FUSION · le doublon `sourceId` est absorbé par `cibleId` (voir
   * fusion-tiers.ts). Tout ce qui pointe vers le doublon est reporté, lu dans
   * le schéma ; ses coordonnées ne comblent que les vides de la fiche
   * conservée ; puis le doublon, qui n'est plus référencé par rien, est
   * supprimé. Une seule transaction · une fusion à moitié faite laisserait
   * deux fiches se partager les comptes d'un même tiers.
   */
  async fusionner(tenantId: string, sourceId: string, cibleId: string) {
    const [source, cible] = await Promise.all([
      this.prisma.tiers.findFirst({ where: { id: sourceId, tenantId } }),
      this.prisma.tiers.findFirst({ where: { id: cibleId, tenantId }, include: { comptesRattaches: true } }),
    ]);
    if (!source || !cible) throw new NotFoundException('Tiers introuvable pour ce dossier.');
    const refus = motifRefusFusionTiers(source, cible);
    if (refus) throw new BadRequestException(refus);

    const reportees = await transactionJournalisee(this.prisma, async (tx) => {
      // Un seul compte principal par tiers · ceux du doublon arrivent
      // secondaires si la fiche conservée a déjà le sien.
      if (cible.comptesRattaches.some((r) => r.estPrincipal)) {
        await tx.tiersCompte.updateMany({ where: { tiersId: source.id }, data: { estPrincipal: false } });
      }
      // Même règle pour les RIB · le prochain virement part sur le RIB
      // principal de la fiche conservée, pas sur celui du doublon.
      if ((await tx.ribTiers.count({ where: { tenantId, tiersId: cible.id, estPrincipal: true } })) > 0) {
        await tx.ribTiers.updateMany({ where: { tenantId, tiersId: source.id }, data: { estPrincipal: false } });
      }
      // UNE PIÈCE DÉJÀ DÉTENUE PAR LA FICHE CONSERVÉE N'EST PAS REPORTÉE · deux
      // doublons portent souvent le même RCCM, et le report violerait l'unicité
      // (tiers, empreinte) : la fusion tomberait en erreur sur le cas même
      // qu'elle existe pour traiter. Même empreinte SHA-256, même contenu ·
      // l'exemplaire du doublon part, et le journal d'audit le trace.
      const detenues = await tx.documentTiers.findMany({
        where: { tenantId, tiersId: cible.id },
        select: { empreinte: true },
      });
      if (detenues.length) {
        await tx.documentTiers.deleteMany({
          where: { tenantId, tiersId: source.id, empreinte: { in: detenues.map((d) => d.empreinte) } },
        });
      }
      const r = await reporterReferences(tx, 'Tiers', source.id, cible.id, tenantId);
      const complement = coordonneesAComblement(source, cible);
      if (Object.keys(complement).length) await tx.tiers.update({ where: { id: cible.id }, data: complement });
      await tx.tiers.delete({ where: { id: source.id } });
      return r;
    });
    return {
      fusionne: true,
      conserve: cible.code,
      supprime: source.code,
      reporte: reportees.map(libelleReference),
    };
  }

  async modifier(tenantId: string, tiersId: string, dto: ModifierTiersDto) {
    await this.trouver(tenantId, tiersId);
    if (dto.modeleReglementId) {
      await this.trouverModeleReglement(tenantId, dto.modeleReglementId);
    }
    // null passe sans contrôle · il DÉTACHE, et détacher ne peut jamais faire
    // sortir de l'agrégat une opération qui doit y rester.
    if (dto.celluleGroupeId) {
      await this.exigerMemeGroupe(tenantId, dto.celluleGroupeId);
    }
    const { dateEffetAutorisationDebits, dateRevocationAutorisationDebits, ...reste } = dto;
    const effet = dateSaisieOuEffacement(dateEffetAutorisationDebits);
    const revocation = dateSaisieOuEffacement(dateRevocationAutorisationDebits);
    // LA COHÉRENCE SE JUGE SUR LA FICHE QUI RÉSULTERA, pas sur la seule
    // requête · une révocation saisie seule se confronte à la date d'effet
    // déjà enregistrée, sans quoi elle pourrait la précéder.
    if (effet !== undefined || revocation !== undefined) {
      const actuel = await this.prisma.tiers.findFirst({
        where: { id: tiersId, tenantId },
        select: { dateEffetAutorisationDebits: true, dateRevocationAutorisationDebits: true },
      });
      const motif = motifRefusPeriodeAutorisationDebits(
        effet === undefined ? actuel?.dateEffetAutorisationDebits : effet,
        revocation === undefined ? actuel?.dateRevocationAutorisationDebits : revocation,
      );
      if (motif) throw new BadRequestException(motif);
    }
    return this.prisma.tiers.update({
      where: { id: tiersId },
      data: {
        ...reste,
        ...(effet === undefined ? {} : { dateEffetAutorisationDebits: effet }),
        ...(revocation === undefined ? {} : { dateRevocationAutorisationDebits: revocation }),
      },
    });
  }

  /**
   * Rattache un compte à ce tiers. Un compte ne peut être rattaché qu'à un
   * seul tiers à la fois (contrainte @unique sur TiersCompte.compteId · voir
   * schéma) ; s'il est marqué Principal, tout autre compte Principal de ce
   * tiers perd cette marque (un seul Principal à la fois).
   */
  async rattacherCompte(tenantId: string, tiersId: string, dto: RattacherCompteDto) {
    await this.trouver(tenantId, tiersId);
    const compte = await this.prisma.compte.findFirst({ where: { id: dto.compteId, tenantId } });
    if (!compte) {
      throw new NotFoundException('Compte introuvable pour ce tenant');
    }
    if (compte.classe !== ClasseCompte.CLASSE_4) {
      throw new BadRequestException('Seul un compte de classe 4 (Tiers) peut être rattaché à un tiers');
    }
    const dejaRattache = await this.prisma.tiersCompte.findUnique({ where: { compteId: dto.compteId } });
    if (dejaRattache && dejaRattache.tiersId !== tiersId) {
      throw new ConflictException('Ce compte est déjà rattaché à un autre tiers');
    }
    if (dejaRattache) {
      throw new ConflictException('Ce compte est déjà rattaché à ce tiers');
    }

    return transactionJournalisee(this.prisma, async (tx) => {
      if (dto.estPrincipal) {
        await tx.tiersCompte.updateMany({ where: { tiersId }, data: { estPrincipal: false } });
      }
      return tx.tiersCompte.create({
        data: { tiersId, compteId: dto.compteId, estPrincipal: !!dto.estPrincipal },
      });
    });
  }

  async definirComptePrincipal(tenantId: string, tiersId: string, compteId: string) {
    await this.trouver(tenantId, tiersId);
    const rattachement = await this.prisma.tiersCompte.findFirst({ where: { tiersId, compteId } });
    if (!rattachement) {
      throw new NotFoundException("Ce compte n'est pas rattaché à ce tiers");
    }
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.tiersCompte.updateMany({ where: { tiersId }, data: { estPrincipal: false } });
      return tx.tiersCompte.update({ where: { id: rattachement.id }, data: { estPrincipal: true } });
    });
  }

  async detacherCompte(tenantId: string, tiersId: string, compteId: string) {
    await this.trouver(tenantId, tiersId);
    const rattachement = await this.prisma.tiersCompte.findFirst({ where: { tiersId, compteId } });
    if (!rattachement) {
      throw new NotFoundException("Ce compte n'est pas rattaché à ce tiers");
    }
    await this.prisma.tiersCompte.delete({ where: { id: rattachement.id } });
    return { compteId, detache: true };
  }

  // -----------------------------------------------------------------------
  // Groupe d'établissements · le garde-fou que la base ne peut pas poser.
  // -----------------------------------------------------------------------

  /**
   * LES DOSSIERS QU'UN TIERS DE CE DOSSIER PEUT DÉSIGNER COMME CELLULE.
   *
   * Un groupe d'établissements n'a QU'UN NIVEAU (voir Tenant.dossierMereId et
   * PlateformeService.modifierGroupe) : une mère dont `dossierMereId` est nul,
   * et ses cellules qui portent son identifiant. Le périmètre visible depuis
   * un dossier se déduit donc entièrement de ces deux cas :
   *  · le dossier courant EST la mère · ses cellules, et elles seules ;
   *  · le dossier courant est une cellule · la mère, et ses dossiers sœurs.
   *
   * Le dossier courant lui-même n'y figure jamais : un tiers ne peut pas être
   * le dossier dans lequel il est ouvert. Sans cette exclusion, une cellule
   * passerait la règle des sœurs, puisqu'elle partage sa propre mère.
   *
   * Un dossier hors groupe (ni mère, ni cellule) rend une liste vide, et
   * l'écran n'a alors rien à proposer · ce qui est exact.
   */
  async dossiersDuGroupe(tenantId: string) {
    const courant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, dossierMereId: true },
    });
    if (!courant) {
      throw new NotFoundException('Dossier introuvable');
    }
    const membres = await this.prisma.tenant.findMany({
      where:
        courant.dossierMereId === null
          ? { dossierMereId: courant.id }
          : { OR: [{ id: courant.dossierMereId }, { dossierMereId: courant.dossierMereId }], NOT: { id: courant.id } },
      // IDENTITÉ SEULE · le nom suffit à choisir dans une liste. Aucune
      // donnée comptable ne franchit ici la frontière du dossier : la lecture
      // transversale des balances reste le monopole de GroupeService, dans le
      // seul sens du lien dossierMereId.
      select: { id: true, nom: true, dossierMereId: true },
      orderBy: { nom: 'asc' },
    });
    return membres.map((m) => ({ id: m.id, nom: m.nom, estDossierMere: m.dossierMereId === null }));
  }

  /**
   * REFUSE UN RATTACHEMENT HORS GROUPE, et la base ne sait pas le faire.
   *
   * La clé étrangère de `Tiers.celluleGroupeId` vise `tenants` sans pouvoir
   * exiger « même dossier mère » · aucune contrainte SQL n'exprime une
   * condition qui compare deux lignes d'une autre table (voir le commentaire
   * du schéma et celui de la migration).
   *
   * CE QUE COÛTERAIT L'ABSENCE DE CONTRÔLE · l'agrégation élimine les
   * opérations réciproques parce que le groupe est UNE SEULE entité (voir
   * `groupe/fondement-elimination.ts` · l'art. 107 de l'AUDCIF, qui régit la
   * combinaison d'entités distinctes et que l'art. 3 du SYCEBNL écarte, n'en
   * est pas le fondement, passe R4). Désigner un
   * dossier étranger au périmètre ferait disparaître de l'agrégat un chiffre
   * d'affaires réellement réalisé avec un tiers · l'inverse exact du défaut
   * que le champ corrige, et sans plus de trace.
   */
  private async exigerMemeGroupe(tenantId: string, celluleGroupeId: string) {
    const membres = await this.dossiersDuGroupe(tenantId);
    const vise = membres.find((m) => m.id === celluleGroupeId);
    if (!vise) {
      throw new BadRequestException(
        "Ce dossier n'appartient pas au groupe d'établissements du dossier courant · seuls le dossier mère " +
          'et ses cellules peuvent être désignés. Le rattachement sert à éliminer de la balance agrégée les ' +
          "opérations internes au groupe ; un dossier hors du périmètre en ferait disparaître des opérations " +
          'réellement conclues avec un tiers · le groupe est une seule entité, et seule une opération entre ses ' +
          'propres dossiers lui est interne.',
      );
    }
    return vise;
  }

  // -----------------------------------------------------------------------
  // Modèles de règlement · entité réutilisable entre tiers (§3.2).
  // -----------------------------------------------------------------------

  private async trouverModeleReglement(tenantId: string, id: string) {
    const modele = await this.prisma.modeleReglement.findFirst({ where: { id, tenantId } });
    if (!modele) {
      throw new NotFoundException('Modèle de règlement introuvable pour ce tenant');
    }
    return modele;
  }

  async listerModelesReglement(tenantId: string) {
    return this.prisma.modeleReglement.findMany({
      where: { tenantId },
      include: { echeances: { orderBy: { ordre: 'asc' } } },
      orderBy: { intitule: 'asc' },
    });
  }

  async creerModeleReglement(tenantId: string, dto: CreerModeleReglementDto) {
    const existant = await this.prisma.modeleReglement.findUnique({
      where: { tenantId_intitule: { tenantId, intitule: dto.intitule } },
    });
    if (existant) {
      throw new ConflictException(`Le modèle de règlement "${dto.intitule}" existe déjà pour ce tenant`);
    }
    return this.prisma.modeleReglement.create({ data: { ...dto, tenantId } });
  }

  async modifierModeleReglement(tenantId: string, id: string, dto: ModifierModeleReglementDto) {
    await this.trouverModeleReglement(tenantId, id);
    return this.prisma.modeleReglement.update({ where: { id }, data: dto });
  }

  // -----------------------------------------------------------------------
  // Fractionnement en plusieurs échéances (§3.2 · pattern Sage : type
  // pourcentage/équilibre/montant + délai + condition, par échéance). Un
  // modèle sans aucune ligne ici reste mono-échéance (delaiJours/echeance du
  // modèle lui-même) · voir calculerEcheances().
  // -----------------------------------------------------------------------

  async listerEcheances(tenantId: string, modeleId: string) {
    await this.trouverModeleReglement(tenantId, modeleId);
    return this.prisma.echeanceReglement.findMany({ where: { modeleReglementId: modeleId }, orderBy: { ordre: 'asc' } });
  }

  async ajouterEcheance(tenantId: string, modeleId: string, dto: CreerEcheanceReglementDto) {
    await this.trouverModeleReglement(tenantId, modeleId);

    if (dto.type !== TypeEcheance.EQUILIBRE && dto.valeur === undefined) {
      throw new BadRequestException(`Une échéance de type ${dto.type} doit préciser une valeur`);
    }

    const existantes = await this.prisma.echeanceReglement.findMany({ where: { modeleReglementId: modeleId } });

    if (dto.type === TypeEcheance.EQUILIBRE && existantes.some((e) => e.type === TypeEcheance.EQUILIBRE)) {
      throw new ConflictException('Ce modèle a déjà une échéance de type Équilibre · une seule est autorisée');
    }
    if (dto.type === TypeEcheance.POURCENTAGE) {
      const sommeExistante = existantes
        .filter((e) => e.type === TypeEcheance.POURCENTAGE)
        .reduce((s, e) => s + Number(e.valeur ?? 0), 0);
      if (sommeExistante + (dto.valeur ?? 0) > 100 + 0.005) {
        throw new BadRequestException(
          `La somme des échéances en pourcentage dépasserait 100 % (${sommeExistante} % déjà réparti)`,
        );
      }
    }

    const dejaCetOrdre = existantes.some((e) => e.ordre === dto.ordre);
    if (dejaCetOrdre) {
      throw new ConflictException(`Une échéance à l'ordre ${dto.ordre} existe déjà pour ce modèle`);
    }
    // L'ÉQUILIBRE SE PLACE EN DERNIER (audit final F149) · il reçoit le reste,
    // et une échéance qui le suivrait se calculerait sur un reste déjà épuisé ·
    // l'échéancier sortait une échéance NÉGATIVE.
    const equilibre = existantes.find((e) => e.type === TypeEcheance.EQUILIBRE);
    if (dto.type === TypeEcheance.EQUILIBRE && existantes.some((e) => e.ordre > dto.ordre)) {
      throw new BadRequestException(
        "L'échéance Équilibre reçoit le reste · elle se place en dernier, après toutes les autres échéances du modèle.",
      );
    }
    if (equilibre && dto.type !== TypeEcheance.EQUILIBRE && dto.ordre > equilibre.ordre) {
      throw new BadRequestException(
        `L'échéance Équilibre (ordre ${equilibre.ordre}) reçoit le reste et reste la dernière · placez celle-ci avant elle.`,
      );
    }

    return this.prisma.echeanceReglement.create({
      data: {
        modeleReglementId: modeleId,
        ordre: dto.ordre,
        type: dto.type,
        valeur: dto.type === TypeEcheance.EQUILIBRE ? null : dto.valeur,
        delaiJours: dto.delaiJours,
        echeance: dto.echeance ?? ConditionEcheance.NET,
      },
    });
  }

  async supprimerEcheance(tenantId: string, modeleId: string, echeanceId: string) {
    await this.trouverModeleReglement(tenantId, modeleId);
    const echeance = await this.prisma.echeanceReglement.findFirst({ where: { id: echeanceId, modeleReglementId: modeleId } });
    if (!echeance) {
      throw new NotFoundException('Échéance introuvable pour ce modèle');
    }
    await this.prisma.echeanceReglement.delete({ where: { id: echeance.id } });
    return { id: echeanceId, supprimee: true };
  }

  /** dateFacture + delaiJours (NET), ou fin du mois de dateFacture + delaiJours (FIN_DE_MOIS). */
  private calculerDateEcheance(dateFacture: Date, delaiJours: number, condition: ConditionEcheance): Date {
    if (condition === ConditionEcheance.NET) {
      const d = new Date(dateFacture);
      d.setUTCDate(d.getUTCDate() + delaiJours);
      return d;
    }
    const finDeMois = new Date(Date.UTC(dateFacture.getUTCFullYear(), dateFacture.getUTCMonth() + 1, 0));
    finDeMois.setUTCDate(finDeMois.getUTCDate() + delaiJours);
    return finDeMois;
  }

  /**
   * Calcule l'échéancier d'un modèle pour une facture donnée : une seule
   * échéance (100 % à delaiJours/echeance du modèle) si aucune ligne
   * `EcheanceReglement` n'existe, sinon le détail par échéance dans l'ordre.
   * SIMULATION · ne persiste rien, et aucune saisie n'applique encore le
   * modèle à une facture · la fenêtre le dit (audit final F149 ; l'ancien
   * commentaire affirmait qu'aucune facture n'existait au modèle de données,
   * ce qui a cessé d'être vrai avec la facturation).
   *
   * AUCUNE ÉCHÉANCE N'EST NÉGATIVE · l'Équilibre se calcule en DERNIER quel
   * que soit son rang (un modèle ancien peut le porter ailleurs), et un
   * pourcentage comme un montant sont bornés au reste.
   */
  async calculerEcheances(tenantId: string, modeleId: string, dto: CalculerEcheancesDto) {
    const modele = await this.trouverModeleReglement(tenantId, modeleId);
    const echeances = await this.prisma.echeanceReglement.findMany({
      where: { modeleReglementId: modeleId },
      orderBy: { ordre: 'asc' },
    });
    const dateFacture = new Date(dto.dateFacture);

    if (echeances.length === 0) {
      return [
        {
          ordre: 1,
          type: null,
          montant: dto.montantTotal,
          dateEcheance: this.calculerDateEcheance(dateFacture, modele.delaiJours, modele.echeance),
        },
      ];
    }

    const equilibre = echeances.find((e) => e.type === TypeEcheance.EQUILIBRE);
    const ordreDeCalcul = equilibre ? [...echeances.filter((e) => e !== equilibre), equilibre] : echeances;
    const montants = new Map<string, number>();
    let reste = dto.montantTotal;
    ordreDeCalcul.forEach((e, i) => {
      const resteArrondi = Math.round(reste * 100) / 100;
      let montant: number;
      if (e.type === TypeEcheance.EQUILIBRE || i === ordreDeCalcul.length - 1) {
        // La dernière échéance absorbe toujours le reste, même si elle
        // n'est pas explicitement de type EQUILIBRE · évite qu'un écart
        // d'arrondi sur les pourcentages laisse un centime non réparti.
        montant = resteArrondi;
      } else if (e.type === TypeEcheance.POURCENTAGE) {
        montant = Math.min(Math.round(dto.montantTotal * (Number(e.valeur) / 100) * 100) / 100, resteArrondi);
      } else {
        montant = Math.min(Number(e.valeur), resteArrondi);
      }
      reste = Math.round((reste - montant) * 100) / 100;
      montants.set(e.id, montant);
    });

    return echeances.map((e) => ({
      ordre: e.ordre,
      type: e.type,
      montant: montants.get(e.id) ?? 0,
      dateEcheance: this.calculerDateEcheance(dateFacture, e.delaiJours, e.echeance),
    }));
  }
}
