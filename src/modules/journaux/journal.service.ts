import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { referencesVers, refuserSiReferences } from '../../common/suppression/references';
import { PrismaService } from '../../common/prisma.service';
import { NumerotationPiece, Prisma, Referentiel, TypeCompteDetailTotal, TypeJournal } from '@prisma/client';
import { journauxDefaut } from './journal-seed';
import { CreerJournalDto, ModifierJournalDto } from './dto/journal.dto';
import { NUMEROTATION_PAR_DEFAUT, prochainNumeroPiece } from './numerotation-piece';
import { comptesDImputationSemes, racineDuCompteSeme } from '../comptes/subdivisions-du-plan';
import { prochainNumeroIndividuel } from '../tiers/collectifs-tiers';
import { motifRefusCompteDeTresorerie, motifRefusNumeroDuJournal } from './compte-propre-du-journal';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';

/** Le compte propre d'un journal ouvert sous ce numéro vient d'être pris · refus nommé. */
function conflitDuCompteOuvert(e: unknown, numero: string, code: string, numeroChoisi: boolean): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    // La cible se lit colonne par colonne · « numerotation » contient
    // « numero », et un conflit sur une autre clé ne se dit pas pour celui-ci.
    const cible = e.meta?.target;
    const colonnes = Array.isArray(cible) ? cible.map(String) : typeof cible === 'string' ? [cible] : [];
    const sur = (col: string) => colonnes.some((c) => c === col || c.endsWith(`_${col}_key`) || c.includes(`_${col}_`));
    if (sur('numero')) {
      throw new ConflictException(
        numeroChoisi
          ? `Le compte ${numero} existe déjà dans ce dossier · choisissez un autre numéro, ou relisez la proposition.`
          : `Le compte ${numero} vient d'être ouvert par une autre saisie · relancez la création, le numéro suivant sera proposé.`,
      );
    }
    if (sur('code')) throw new ConflictException(`Le journal ${code} vient d'être créé par une autre saisie · relancez la demande.`);
  }
  throw e;
}

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appelé une fois à la création du tenant, juste après le seed du plan de
   * comptes (voir AuthService.register) · les comptes de trésorerie
   * référencés par journauxDefaut() doivent déjà exister · le compte de
   * caisse diffère selon le référentiel, voir journal-seed.ts.
   */
  /**
   * `client` reçoit la transaction de `AuthService.register` quand le semis
   * fait partie d'une création de dossier · hors de ce cas il vaut
   * `this.prisma` et rien ne change pour les autres appelants.
   */
  async seedJournauxDefaut(tenantId: string, referentiel: Referentiel, client: Prisma.TransactionClient = this.prisma) {
    for (const j of journauxDefaut(referentiel)) {
      let compteTresorerieId: string | undefined;
      if (j.numeroCompteTresorerie) {
        const compte = await client.compte.findUnique({
          where: { tenantId_numero: { tenantId, numero: j.numeroCompteTresorerie } },
        });
        compteTresorerieId = compte?.id;
      }
      await client.journal.upsert({
        where: { tenantId_code: { tenantId, code: j.code } },
        update: {},
        create: {
          tenantId,
          code: j.code,
          intitule: j.intitule,
          type: j.type,
          numerotation: j.numerotation,
          compteTresorerieId,
        },
      });
    }
  }

  async lister(tenantId: string, actifsSeuls?: boolean) {
    return this.prisma.journal.findMany({
      where: { tenantId, ...(actifsSeuls ? { estActif: true } : {}) },
      include: { compteTresorerie: true },
      orderBy: { code: 'asc' },
    });
  }

  async trouver(tenantId: string, journalId: string) {
    const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId } });
    if (!journal) {
      throw new NotFoundException('Journal introuvable pour ce tenant');
    }
    return journal;
  }

  async creer(tenantId: string, dto: CreerJournalDto) {
    if (dto.ouvrirCompteSousId && dto.compteTresorerieId) {
      throw new BadRequestException(
        'Choisissez un compte existant OU ouvrez le compte propre du journal, pas les deux.',
      );
    }
    if (dto.ouvrirCompteSousId && dto.type !== TypeJournal.TRESORERIE) {
      throw new BadRequestException('Seul un journal de trésorerie (banque, caisse) ouvre son compte propre.');
    }
    if (dto.numeroCompte !== undefined && !dto.ouvrirCompteSousId) {
      throw new BadRequestException(
        "Un numéro de compte ne se choisit qu'avec le compte du plan sous lequel ouvrir le compte du journal.",
      );
    }
    if (dto.type === TypeJournal.TRESORERIE && !dto.compteTresorerieId && !dto.ouvrirCompteSousId) {
      throw new BadRequestException('Un journal de type Trésorerie doit avoir un compte de trésorerie associé');
    }
    const existant = await this.prisma.journal.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
    if (existant) {
      throw new ConflictException(`Le journal ${dto.code} existe déjà pour ce tenant`);
    }
    if (dto.compteTresorerieId) await this.verifierCompteTresorerie(tenantId, dto.compteTresorerieId);
    const donnees = {
      tenantId,
      code: dto.code,
      intitule: dto.intitule,
      type: dto.type,
      // CONTINUE PAR JOURNAL À DÉFAUT (audit final F59) · en MANUELLE
      // OmegaX n'attribue aucun numéro, et aucune saisie n'en porte · un
      // journal créé sans choix recevait donc des pièces sans numéro, alors
      // que la pièce se cite par sa référence (AUDCIF art. 17, 3° ; CPCC
      // § 3.2). La manuelle reste un choix, jamais un défaut.
      numerotation: dto.numerotation ?? NUMEROTATION_PAR_DEFAUT,
      contrepartieChaqueLigne: dto.type === TypeJournal.TRESORERIE && dto.contrepartieChaqueLigne === true,
    };
    if (!dto.ouvrirCompteSousId) {
      return this.prisma.journal.create({ data: { ...donnees, compteTresorerieId: dto.compteTresorerieId } });
    }
    // LE COMPTE NAÎT AVEC LE JOURNAL, dans la même transaction · un journal
    // refusé ne laisse pas de compte orphelin, un compte refusé pas de journal
    // sans compte.
    const ouvert = await this.compteAOuvrir(tenantId, dto.ouvrirCompteSousId);
    // Choisi ou proposé, le numéro passe la même règle · la proposition ne
    // dispense de rien.
    const juger = (numero: string | null) => {
      if (numero === null) throw new BadRequestException(ouvert.motif ?? 'Aucun numéro libre sous ce compte du plan.');
      const motif = motifRefusNumeroDuJournal(numero, ouvert.parent.numero, ouvert.racine, ouvert.longueur, ouvert.referentiel);
      if (motif) throw new BadRequestException(motif);
      return numero;
    };
    const numeroChoisi = dto.numeroCompte !== undefined;
    let numeroRetenu = numeroChoisi ? juger(dto.numeroCompte ?? null) : juger(ouvert.propose);
    return transactionJournalisee(this.prisma, async (tx) => {
      // LE NUMÉRO PROPOSÉ SE PREND SOUS VERROU, comme celui d'un tiers (même
      // clé, tiers.service.ts) · deux journaux créés ensemble lisaient le même
      // premier libre, et le second recevait « choisissez un autre numéro »
      // sans en avoir choisi aucun.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`panoplie:${tenantId}`}))`;
      if (!numeroChoisi) {
        const existants = await tx.compte.findMany({
          where: { tenantId, numero: { startsWith: ouvert.racine } },
          select: { numero: true },
        });
        numeroRetenu = juger(
          prochainNumeroIndividuel(ouvert.racine, ouvert.longueur, [ouvert.parent.numero, ...existants.map((c) => c.numero)]),
        );
      }
      const compte = await tx.compte.create({
        data: {
          tenantId,
          numero: numeroRetenu,
          intitule: dto.intitule,
          classe: ouvert.parent.classe,
          typeCompte: TypeCompteDetailTotal.DETAIL,
          modeReportANouveau: ouvert.parent.modeReportANouveau,
          lettrable: ouvert.parent.lettrable,
          // Créé par le cabinet, il naît retenu (comptes-proposes.ts).
          estRetenu: true,
        },
        select: { id: true },
      });
      return tx.journal.create({ data: { ...donnees, compteTresorerieId: compte.id } });
    }).catch((e) => conflitDuCompteOuvert(e, numeroRetenu, dto.code, numeroChoisi));
  }

  /**
   * LES COMPTES DU PLAN SOUS LESQUELS UN JOURNAL OUVRE SON COMPTE · les comptes
   * d'imputation SEMÉS du dossier, actifs, qui tiennent des fonds
   * (`motifRefusCompteDeTresorerie` · banques, établissements financiers,
   * monnaie électronique, caisse, et au SYSCOHADA régies d'avance et
   * accréditifs). Lus par leur numéro, jamais par la
   * règle des comptes retenus · ouvrir une banque sous le 52200000 est souvent le
   * PREMIER usage de ce compte, et la règle viderait la liste
   * (`comptes/listes-de-comptes.ts`).
   */
  async comptesDuPlanPourJournal(tenantId: string) {
    const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { referentiel: true },
    });
    return this.prisma.compte.findMany({
      where: {
        tenantId,
        numero: { in: comptesDImputationSemes(referentiel, '5').filter((n) => motifRefusCompteDeTresorerie(n, referentiel) === null) },
        estActif: true,
      },
      select: { id: true, numero: true, intitule: true },
      orderBy: { numero: 'asc' },
    });
  }

  /** Le numéro que le compte propre d'un journal prendrait sous ce compte du plan. */
  async compteDuJournalPropose(tenantId: string, sousId: string) {
    const ouvert = await this.compteAOuvrir(tenantId, sousId);
    return {
      numero: ouvert.propose,
      racine: ouvert.racine,
      longueur: ouvert.longueur,
      compteDuPlan: { numero: ouvert.parent.numero, intitule: ouvert.parent.intitule },
      motif: ouvert.motif,
    };
  }

  /**
   * Le compte du plan choisi, sa racine et le premier numéro libre dessous.
   * Refus nommé hors d'un compte d'imputation semé de la classe 5, actif, du
   * dossier.
   */
  private async compteAOuvrir(tenantId: string, sousId: string) {
    const [dossier, parent] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true, longueurCompte: true } }),
      this.prisma.compte.findFirst({
        where: { id: sousId, tenantId },
        select: {
          numero: true,
          intitule: true,
          classe: true,
          typeCompte: true,
          estActif: true,
          modeReportANouveau: true,
          lettrable: true,
        },
      }),
    ]);
    if (!parent) throw new NotFoundException('Compte du plan introuvable pour ce dossier.');
    const racine = racineDuCompteSeme(dossier.referentiel, parent.numero);
    if (racine === null || parent.typeCompte !== TypeCompteDetailTotal.DETAIL) {
      throw new BadRequestException(
        `Le compte ${parent.numero} n'est pas un compte d'imputation du plan · le compte propre d'un journal de ` +
          "banque ou de caisse s'ouvre sous l'un d'eux.",
      );
    }
    const horsDesFonds = motifRefusCompteDeTresorerie(parent.numero, dossier.referentiel);
    if (horsDesFonds) throw new BadRequestException(horsDesFonds);
    if (!parent.estActif) {
      throw new BadRequestException(`Le compte ${parent.numero} est en sommeil · réactivez-le dans le plan comptable.`);
    }
    const existants = await this.prisma.compte.findMany({
      where: { tenantId, numero: { startsWith: racine } },
      select: { numero: true },
    });
    const propose = prochainNumeroIndividuel(racine, dossier.longueurCompte, [parent.numero, ...existants.map((c) => c.numero)]);
    return {
      parent,
      racine,
      referentiel: dossier.referentiel,
      longueur: dossier.longueurCompte,
      propose,
      motif: propose
        ? null
        : `Plus aucun numéro libre sous le compte ${parent.numero} à ${dossier.longueurCompte} chiffres · allongez ` +
          'les numéros de compte (Structure > Paramètres du dossier).',
    };
  }

  /**
   * LE COMPTE DE TRÉSORERIE D'UN JOURNAL (audit final F60) · l'identifiant
   * était écrit tel qu'il arrivait. Un compte d'un autre dossier était
   * accepté puis rendu par l'`include` de la liste ; un compte de classe 6
   * ou un compte Total recevait la contrepartie de chaque ligne. Il est lu
   * borné au dossier, de trésorerie (classe 5, lue dans le numéro comme
   * partout) et d'imputation · un compte Total ne reçoit jamais d'écriture.
   */
  private async verifierCompteTresorerie(tenantId: string, compteId: string, journalId?: string) {
    const compte = await this.prisma.compte.findFirst({
      where: { id: compteId, tenantId },
      select: { numero: true, typeCompte: true },
    });
    if (!compte) throw new BadRequestException('Compte de trésorerie introuvable pour ce dossier.');
    // Même règle que le compte ouvert avec le journal · jugée au choix du
    // compte seulement, un journal qui porte déjà un autre compte n'est pas
    // enfermé.
    const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    const horsDesFonds = motifRefusCompteDeTresorerie(compte.numero, referentiel);
    if (horsDesFonds) throw new BadRequestException(horsDesFonds);
    if (compte.typeCompte !== TypeCompteDetailTotal.DETAIL) {
      throw new BadRequestException(
        `Le compte ${compte.numero} est un compte Total · il ne reçoit aucune écriture, choisissez un compte de détail.`,
      );
    }
    // UN COMPTE PAR JOURNAL DE BANQUE OU DE CAISSE (décision de Manasse du
    // 2026-10-09 · « chaque journal banque ou caisse doit être rattaché à un
    // numéro de compte personnalisé ») · deux journaux sur un même 52 mêlent
    // deux banques dans un seul solde, et le rapprochement, qui se fait compte
    // par compte contre UN relevé (fiche du compte 52), devient impossible.
    // Jugé au choix du compte seulement · un dossier qui partage déjà un compte
    // n'est pas enfermé, il le change quand il le veut.
    const autre = await this.prisma.journal.findFirst({
      where: { tenantId, compteTresorerieId: compteId, ...(journalId ? { id: { not: journalId } } : {}) },
      select: { code: true },
    });
    if (autre) {
      throw new BadRequestException(
        `Le compte ${compte.numero} est déjà celui du journal ${autre.code} · chaque journal de banque ou de caisse a son ` +
          'propre compte. Ouvrez dans le Plan comptable un compte de détail pour cette banque ou cette caisse, puis choisissez-le.',
      );
    }
  }

  /** SUPPRESSION D'UN JOURNAL · refusée s'il porte une écriture ou sert ailleurs (references.ts). */
  async supprimer(tenantId: string, journalId: string) {
    const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId } });
    if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    refuserSiReferences(`Le journal ${journal.code}`, await referencesVers(this.prisma, 'Journal', journal.id, tenantId));
    await this.prisma.journal.delete({ where: { id: journal.id } });
    return { supprime: true };
  }

  async modifier(tenantId: string, journalId: string, dto: ModifierJournalDto) {
    const journal = await this.trouver(tenantId, journalId);

    // Le type n'est pas modifiable ici, mais compteTresorerieId l'est : sans
    // ce contrôle, un appel direct à l'API (ex. { compteTresorerieId: null })
    // pourrait retirer le compte de trésorerie d'un journal TRESORERIE et
    // laisser passer un état invalide que creer() interdit pourtant à la
    // création (voir le contrôle symétrique dans creer() ci-dessus).
    if (journal.type === TypeJournal.TRESORERIE && dto.compteTresorerieId === null) {
      throw new BadRequestException('Un journal de type Trésorerie doit avoir un compte de trésorerie associé');
    }
    if (dto.compteTresorerieId && dto.compteTresorerieId !== journal.compteTresorerieId) {
      await this.verifierCompteTresorerie(tenantId, dto.compteTresorerieId, journal.id);
    }

    // Une contrepartie de trésorerie n'a de sens que sur un journal de
    // trésorerie · cochée sur un journal d'achats, elle solderait chaque charge
    // contre une banque que le journal ne porte pas.
    if (dto.contrepartieChaqueLigne === true && journal.type !== TypeJournal.TRESORERIE) {
      throw new BadRequestException(
        `La contrepartie à chaque ligne ne vaut que pour un journal de trésorerie · ${journal.code} est un journal ${journal.type.toLowerCase()}.`,
      );
    }
    return this.prisma.journal.update({ where: { id: journal.id }, data: dto });
  }

  /**
   * Numéro de pièce · le calcul vit dans `numerotation-piece.ts`, appelable
   * sans injecter ce service · quatre chemins de création d'écriture ne
   * l'appelaient pas du tout (voir le commentaire de ce fichier). La méthode
   * reste ici pour les appelants qui ont déjà le service en main.
   */
  async prochainNumeroPiece(
    tenantId: string,
    journal: { id: string; numerotation: NumerotationPiece },
    exerciceId: string,
    date: Date,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number | null> {
    return prochainNumeroPiece(tx, tenantId, journal, exerciceId, date);
  }
}
