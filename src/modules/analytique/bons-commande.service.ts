import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NatureEngagement,
  NatureFacture,
  Prisma,
  SensFacture,
  StatutBonCommande,
  StatutEcriture,
  StatutEngagement,
  StatutExercice,
  TypeCompteDetailTotal,
  TypeTiers,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { exigerExercice } from '../../common/exercice-requis';
import { jourDeKinshasaIso } from '../../common/echeance';
import { MOTIF_EXERCICE_BUDGETAIRE_CLOS } from './exercice-budgetaire-clos';
import {
  engageParSection,
  enCentimesExacts,
  francs,
  montantHTEnCentimes,
  motifRefusParts,
  referenceEngagement,
  jourValide,
  resteParSection,
} from './bon-commande';
import {
  CloreBonCommandeDto,
  CreerBonCommandeDto,
  ExecuterBonCommandeDto,
  LigneBonCommandeDto,
  ModifierBonCommandeDto,
  RemettreBonCommandeDto,
} from './dto/bon-commande.dto';

/** Ce que la liste rend à la fois · le reste se dit (§ 8 bis). */
const PLAFOND_LISTE = 500;
/** Ce que le choix de la facture propose à la fois · la recherche va au serveur. */
const PLAFOND_FACTURES = 200;

type Tx = Prisma.TransactionClient;

const enCentimes = (d: Prisma.Decimal | number | string) => Math.round(Number(d) * 100);
const decimal = (centimes: number) => new Prisma.Decimal(centimes).div(100);
const jour = (d: Date) => d.toISOString().slice(0, 10);
const jourFr = (iso: string) => iso.split('-').reverse().join('/');

/**
 * BONS DE COMMANDE FOURNISSEUR (ligne microfina-m2, idée 2).
 *
 * Le bon FAIT NAÎTRE l'engagement de dépense à sa remise (SYCEBNL, Guide
 * d'application, ch. 7, Application 22, règle (d)), un par ligne budgétaire,
 * et la facture d'achat passée au journal l'EXÉCUTE · c'est le rattachement
 * qui fait sortir la dépense de la colonne Engagement au moment où elle entre
 * au 40 (`EngagementService`, « le reste à exécuter, jamais le montant
 * entier »). Aucune écriture comptable à la commande.
 *
 * TOUT GESTE SE JUGE SOUS UN VERROU DU DOSSIER, DANS SA TRANSACTION · deux
 * remises concurrentes prendraient le même numéro, deux factures déclarées en
 * même temps dépasseraient ensemble le reste à facturer qu'aucune ne dépasse
 * seule.
 */
@Injectable()
export class BonsCommandeService {
  constructor(private readonly prisma: PrismaService) {}

  private async verrou(tx: Tx, tenantId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bons-commande:${tenantId}`}))`;
  }

  /** Le registre d'un exercice, les plus récents d'abord · tranche dite. */
  async lister(tenantId: string, exerciceId: string) {
    exigerExercice(exerciceId);
    const [bons, total] = await Promise.all([
      this.prisma.bonCommandeFournisseur.findMany({
        where: { tenantId, exerciceId },
        orderBy: [{ numero: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
        take: PLAFOND_LISTE,
        include: {
          lignes: { select: { sectionId: true, montantHT: true, montantTva: true } },
          executions: { select: { sectionId: true, montant: true } },
        },
      }),
      this.prisma.bonCommandeFournisseur.count({ where: { tenantId, exerciceId } }),
    ]);
    return {
      bons: bons.map((b) => {
        const engage = engageParSection(b.lignes.map((l) => ({ sectionId: l.sectionId, montantHTCentimes: enCentimes(l.montantHT), montantTvaCentimes: enCentimes(l.montantTva) })));
        const reste = resteParSection(engage, b.executions.map((e) => ({ sectionId: e.sectionId, montantCentimes: enCentimes(e.montant) })));
        const totalCentimes = [...engage.values()].reduce((s, v) => s + v, 0);
        const resteCentimes = [...reste.values()].reduce((s, v) => s + v, 0);
        return {
          id: b.id,
          numero: b.numero,
          statut: b.statut,
          objet: b.objet,
          fournisseurNom: b.fournisseurNom,
          tiersId: b.tiersId,
          dateRemise: b.dateRemise ? jour(b.dateRemise) : null,
          montantTTC: totalCentimes / 100,
          resteAFacturer: b.statut === StatutBonCommande.CLOS ? 0 : resteCentimes / 100,
          resteAvantCloture: resteCentimes / 100,
          motifCloture: b.motifCloture,
        };
      }),
      total,
      tronque: total > bons.length,
    };
  }

  /** Un bon, ses lignes, ses factures et le reste de chaque ligne budgétaire. */
  async detail(tenantId: string, id: string) {
    const b = await this.prisma.bonCommandeFournisseur.findFirst({
      where: { id, tenantId },
      include: {
        tiers: { select: { id: true, code: true, nom: true } },
        exercice: { select: { id: true, statut: true, dateDebut: true, dateFin: true } },
        lignes: { orderBy: { ordre: 'asc' }, include: { section: { select: { id: true, code: true, intitule: true } } } },
        executions: {
          orderBy: { createdAt: 'asc' },
          include: {
            facture: { select: { id: true, numeroSerie: true, dateFacture: true, noteDeCredit: { select: { numeroSerie: true } }, ecriture: { select: { id: true, exerciceId: true, numeroPiece: true } } } },
            section: { select: { code: true } },
          },
        },
        engagements: { select: { id: true, reference: true, sectionId: true, statut: true } },
      },
    });
    if (!b) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
    const engage = engageParSection(b.lignes.map((l) => ({ sectionId: l.sectionId, montantHTCentimes: enCentimes(l.montantHT), montantTvaCentimes: enCentimes(l.montantTva) })));
    const reste = resteParSection(engage, b.executions.map((e) => ({ sectionId: e.sectionId, montantCentimes: enCentimes(e.montant) })));
    const sections = new Map(b.lignes.map((l) => [l.sectionId, l.section]));
    return {
      id: b.id,
      numero: b.numero,
      statut: b.statut,
      objet: b.objet,
      tiers: b.tiers,
      fournisseurNom: b.fournisseurNom,
      exercice: { id: b.exercice.id, statut: b.exercice.statut },
      dateRemise: b.dateRemise ? jour(b.dateRemise) : null,
      motifCloture: b.motifCloture,
      lignes: b.lignes.map((l) => ({
        id: l.id,
        ordre: l.ordre,
        designation: l.designation,
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire),
        montantHT: Number(l.montantHT),
        montantTva: Number(l.montantTva),
        section: l.section,
      })),
      parSection: [...engage.entries()].map(([sectionId, c]) => ({
        section: sections.get(sectionId),
        engage: c / 100,
        resteAFacturer: (reste.get(sectionId) ?? 0) / 100,
        engagement: b.engagements.find((e) => e.sectionId === sectionId) ?? null,
      })),
      factures: regrouperParFacture(b.executions),
    };
  }

  /** Les lignes saisies, contrôlées et chiffrées · le HT est calculé, la taxe prévue saisie. */
  private async preparerLignes(tenantId: string, lignes: LigneBonCommandeDto[], db: Tx | PrismaService) {
    const ids = [...new Set(lignes.map((l) => l.sectionId))];
    const sections = await db.sectionAnalytique.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, code: true, type: true, estActive: true, plan: { select: { code: true, gererBudgets: true, estActif: true } } },
    });
    const parId = new Map(sections.map((s) => [s.id, s]));
    return lignes.map((l, i) => {
      const s = parId.get(l.sectionId);
      if (!s) throw new NotFoundException(`Ligne ${i + 1} · ligne budgétaire introuvable dans ce dossier.`);
      // UNE LIGNE DU TABLEAU, PAS UNE RUBRIQUE · une section TOTAL ne reçoit ni
      // budget ni engagement (rubriques budgétaires), et une section d'un plan
      // qui ne gère pas les budgets ne paraît sur aucun tableau.
      if (!s.plan.gererBudgets || !s.plan.estActif) {
        throw new BadRequestException(
          `Ligne ${i + 1} · la section ${s.code} appartient au plan « ${s.plan.code} », qui ne gère pas les budgets · ` +
            "un bon de commande engage une ligne du tableau d'exécution budgétaire (règle (d) de l'Application 22).",
        );
      }
      if (s.type !== TypeCompteDetailTotal.DETAIL || !s.estActive) {
        throw new BadRequestException(`Ligne ${i + 1} · la section ${s.code} est une rubrique (Total) ou en sommeil · choisissez une section Détail active.`);
      }
      if (!Number.isFinite(l.quantite) || l.quantite <= 0) throw new BadRequestException(`Ligne ${i + 1} · la quantité doit être positive.`);
      const pu = enCentimesExacts(l.prixUnitaire);
      if (pu === null || pu < 0) throw new BadRequestException(`Ligne ${i + 1} · le prix unitaire est un montant positif ou nul, au centime.`);
      const tva = enCentimesExacts(l.montantTva ?? 0);
      if (tva === null || tva < 0) throw new BadRequestException(`Ligne ${i + 1} · la taxe prévue est un montant positif ou nul, au centime.`);
      const ht = montantHTEnCentimes(l.quantite, l.prixUnitaire);
      return {
        ordre: i + 1,
        designation: l.designation.trim(),
        quantite: new Prisma.Decimal(l.quantite),
        prixUnitaire: decimal(pu),
        montantHT: decimal(ht),
        montantTva: decimal(tva),
        sectionId: s.id,
        _ttc: ht + tva,
      };
    });
  }

  private async fournisseur(tenantId: string, tiersId: string, db: Tx | PrismaService) {
    const t = await db.tiers.findFirst({ where: { id: tiersId, tenantId }, select: { id: true, nom: true, type: true, estActif: true } });
    if (!t) throw new NotFoundException('Fournisseur introuvable dans ce dossier.');
    if (t.type !== TypeTiers.FOURNISSEUR) throw new BadRequestException(`« ${t.nom} » n'est pas un fournisseur · un bon de commande s'adresse à un fournisseur.`);
    if (!t.estActif) throw new BadRequestException(`Le fournisseur « ${t.nom} » est en sommeil · réactivez-le (Structure > Plan des tiers) avant de lui adresser une commande.`);
    return t;
  }

  async creer(tenantId: string, userId: string, dto: CreerBonCommandeDto) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { id: true, statut: true } });
    if (!exercice) throw new NotFoundException('Exercice introuvable dans ce dossier.');
    if (exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(MOTIF_EXERCICE_BUDGETAIRE_CLOS);
    await this.fournisseur(tenantId, dto.tiersId, this.prisma);
    const lignes = await this.preparerLignes(tenantId, dto.lignes, this.prisma);
    return transactionJournalisee(this.prisma, async (tx) => {
      const bon = await tx.bonCommandeFournisseur.create({
        data: { tenantId, exerciceId: exercice.id, tiersId: dto.tiersId, objet: dto.objet.trim(), createdBy: userId },
      });
      for (const { _ttc, ...l } of lignes) {
        void _ttc;
        await tx.ligneBonCommande.create({ data: { ...l, tenantId, bonId: bon.id } });
      }
      return { id: bon.id };
    });
  }

  /** Le brouillon seul se retouche · un bon remis est une pièce datée (AUDCIF art. 17, 3°). */
  async modifier(tenantId: string, id: string, dto: ModifierBonCommandeDto) {
    await this.fournisseur(tenantId, dto.tiersId, this.prisma);
    const lignes = await this.preparerLignes(tenantId, dto.lignes, this.prisma);
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrou(tx, tenantId);
      const bon = await tx.bonCommandeFournisseur.findFirst({ where: { id, tenantId }, select: { id: true, statut: true, exercice: { select: { statut: true } } } });
      if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
      if (bon.statut !== StatutBonCommande.BROUILLON) {
        throw new BadRequestException('Ce bon a été remis au fournisseur · il ne se modifie plus. Clôturez-le avec son motif et établissez-en un autre.');
      }
      // UN BROUILLON D'UN EXERCICE CLÔTURÉ NE SE RETOUCHE PLUS (relecture m2) ·
      // il ne se remettra jamais (la remise y est refusée) ; il se supprime.
      if (bon.exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(`${MOTIF_EXERCICE_BUDGETAIRE_CLOS} Ce brouillon ne se remettra plus · supprimez-le, et établissez le bon dans l'exercice ouvert.`);
      await tx.bonCommandeFournisseur.update({ where: { id }, data: { tiersId: dto.tiersId, objet: dto.objet.trim() } });
      // LES LIGNES SE RETIRENT UNE À UNE · par identifiant, pour que le journal
      // d'audit garde chacune (un `deleteMany` n'y laisse que son filtre).
      const anciennes = await tx.ligneBonCommande.findMany({ where: { tenantId, bonId: id }, select: { id: true } });
      for (const a of anciennes) await tx.ligneBonCommande.delete({ where: { id: a.id } });
      for (const { _ttc, ...l } of lignes) {
        void _ttc;
        await tx.ligneBonCommande.create({ data: { ...l, tenantId, bonId: id } });
      }
      return { id };
    });
  }

  async supprimer(tenantId: string, id: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrou(tx, tenantId);
      const bon = await tx.bonCommandeFournisseur.findFirst({ where: { id, tenantId }, select: { id: true, statut: true } });
      if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
      if (bon.statut !== StatutBonCommande.BROUILLON) {
        throw new BadRequestException('Un bon remis ne se supprime pas · c’est une pièce justificative (AUDCIF art. 17, 3°). Clôturez-le avec son motif.');
      }
      const lignes = await tx.ligneBonCommande.findMany({ where: { tenantId, bonId: id }, select: { id: true } });
      for (const l of lignes) await tx.ligneBonCommande.delete({ where: { id: l.id } });
      await tx.bonCommandeFournisseur.delete({ where: { id } });
      return { supprime: true };
    });
  }

  /**
   * LA REMISE ENGAGE · « bons de commande […] REMIS aux fournisseurs au cours
   * de l'exercice budgétaire » (règle (d)). Elle numérote le bon, recopie le
   * fournisseur et fait naître un engagement par ligne budgétaire, TTC prévu.
   */
  async remettre(tenantId: string, userId: string, id: string, dto: RemettreBonCommandeDto) {
    // UN JOUR QUI EXISTE (relecture m1) · « 2026-02-31 » passait la forme et
    // devenait le 3 mars, engagé sur un jour que personne n'a écrit.
    const dateRemise = jourValide(dto.dateRemise);
    if (!dateRemise) throw new BadRequestException(`La date de remise « ${dto.dateRemise} » n'est pas un jour du calendrier (AAAA-MM-JJ).`);
    if (dateRemise > jourDeKinshasaIso(new Date())) {
      throw new BadRequestException('La date de remise ne peut pas être future · un bon engage le jour où il est remis au fournisseur.');
    }
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrou(tx, tenantId);
      const bon = await tx.bonCommandeFournisseur.findFirst({
        where: { id, tenantId },
        include: {
          exercice: { select: { id: true, statut: true, dateDebut: true, dateFin: true } },
          lignes: { include: { section: { select: { code: true, type: true, estActive: true, plan: { select: { gererBudgets: true, estActif: true } } } } } },
          tiers: { select: { nom: true, type: true, estActif: true } },
        },
      });
      if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
      if (bon.statut !== StatutBonCommande.BROUILLON) throw new ConflictException('Ce bon a déjà été remis · rechargez le registre.');
      // LE FOURNISSEUR EST RELU À LA REMISE (relecture m3) · mis en sommeil
      // depuis le brouillon, il recevrait une commande que le dossier a cessé
      // de lui passer.
      if (bon.tiers.type !== TypeTiers.FOURNISSEUR || !bon.tiers.estActif) {
        throw new BadRequestException(`Le fournisseur « ${bon.tiers.nom} » est en sommeil ou n'est plus un fournisseur · réactivez-le (Structure > Plan des tiers) ou choisissez-en un autre sur le brouillon.`);
      }
      if (bon.exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(MOTIF_EXERCICE_BUDGETAIRE_CLOS);
      if (dateRemise < jour(bon.exercice.dateDebut) || dateRemise > jour(bon.exercice.dateFin)) {
        throw new BadRequestException(
          `La date de remise (${jourFr(dateRemise)}) est hors de l'exercice du bon (${jourFr(jour(bon.exercice.dateDebut))} au ` +
            `${jourFr(jour(bon.exercice.dateFin))}) · le guide ne retient que les bons remis « au cours de l'exercice budgétaire ».`,
        );
      }
      if (bon.lignes.length === 0) throw new BadRequestException('Le bon ne porte aucune ligne · rien à engager.');
      // Les lignes sont relues AU MOMENT DE LA REMISE · une section passée en
      // sommeil ou un plan retiré des budgets depuis la saisie du brouillon
      // ferait naître un engagement sur une ligne qu'aucun tableau ne lit.
      for (const l of bon.lignes) {
        if (!l.section.plan.gererBudgets || !l.section.plan.estActif || l.section.type !== TypeCompteDetailTotal.DETAIL || !l.section.estActive) {
          throw new BadRequestException(`La ligne « ${l.designation} » vise la section ${l.section.code}, qui n'est plus une ligne budgétaire active · corrigez le brouillon.`);
        }
      }
      const dernier = await tx.bonCommandeFournisseur.aggregate({ where: { tenantId }, _max: { numero: true } });
      const numero = (dernier._max.numero ?? 0) + 1;
      await tx.bonCommandeFournisseur.update({
        where: { id },
        data: {
          numero,
          statut: StatutBonCommande.REMIS,
          dateRemise: new Date(`${dateRemise}T00:00:00.000Z`),
          fournisseurNom: bon.tiers.nom,
          remisLe: new Date(),
          remisPar: userId,
        },
      });
      const engage = engageParSection(bon.lignes.map((l) => ({ sectionId: l.sectionId, montantHTCentimes: enCentimes(l.montantHT), montantTvaCentimes: enCentimes(l.montantTva) })));
      const codes = new Map(bon.lignes.map((l) => [l.sectionId, l.section.code]));
      for (const [sectionId, centimes] of engage) {
        // UNE COMMANDE GRATUITE N'ENGAGE RIEN · l'engagement exige un montant
        // strictement positif (registre), et une ligne à zéro n'a rien à peser.
        if (centimes <= 0) continue;
        const reference = referenceEngagement(numero, codes.get(sectionId) ?? '');
        const doublon = await tx.engagementDepense.findFirst({
          where: { tenantId, exerciceId: bon.exerciceId, nature: NatureEngagement.BON_DE_COMMANDE, reference },
          select: { id: true },
        });
        if (doublon) {
          throw new ConflictException(
            `Le registre des engagements porte déjà la référence « ${reference} » sur cet exercice · renommez l'engagement saisi à la main avant de remettre ce bon.`,
          );
        }
        await tx.engagementDepense.create({
          data: {
            tenantId,
            exerciceId: bon.exerciceId,
            sectionId,
            nature: NatureEngagement.BON_DE_COMMANDE,
            reference,
            objet: bon.objet,
            beneficiaire: bon.tiers.nom,
            date: new Date(`${dateRemise}T00:00:00.000Z`),
            montant: decimal(centimes),
            createdBy: userId,
            bonCommandeId: id,
          },
        });
      }
      return { id, numero };
    });
  }

  /**
   * LES FACTURES QUI PEUVENT EXÉCUTER LE BON · achats du même fournisseur, non
   * barrés, passés au journal et validés (seul le livre-journal entre au
   * tableau, F140). Tranche dite, recherche au serveur.
   */
  async facturesExecutables(tenantId: string, id: string, recherche?: string) {
    const bon = await this.prisma.bonCommandeFournisseur.findFirst({ where: { id, tenantId }, select: { tiersId: true } });
    if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
    const texte = recherche?.trim();
    const where: Prisma.FactureWhereInput = {
      sens: SensFacture.ACHAT,
      nature: NatureFacture.FACTURE,
      tiersId: bon.tiersId,
      noteDeCredit: { is: null },
      ecriture: { is: { statut: StatutEcriture.VALIDEE } },
      ...(texte ? { numeroSerie: { contains: texte, mode: 'insensitive' as const } } : {}),
    };
    const [factures, total] = await Promise.all([
      this.prisma.facture.findMany({
        where: { tenantId, ...where },
        orderBy: [{ dateFacture: 'desc' }],
        take: PLAFOND_FACTURES,
        select: {
          id: true,
          numeroSerie: true,
          dateFacture: true,
          autresImpotsEtTaxes: true,
          lignes: { select: { montantHT: true, montantTva: true } },
          executionsBonCommande: { select: { montant: true } },
          ecriture: { select: { numeroPiece: true, exerciceId: true } },
        },
      }),
      this.prisma.facture.count({ where: { tenantId, ...where } }),
    ]);
    return {
      factures: factures.map((f) => {
        const ttc = ttcDeLaFacture(f);
        const servi = f.executionsBonCommande.reduce((s, e) => s + enCentimes(e.montant), 0);
        return {
          id: f.id,
          numeroSerie: f.numeroSerie,
          dateFacture: jour(f.dateFacture),
          numeroPiece: f.ecriture?.numeroPiece ?? null,
          montantTTC: ttc / 100,
          dejaAffecte: servi / 100,
          disponible: Math.max(0, ttc - servi) / 100,
        };
      }),
      total,
      tronque: total > factures.length,
    };
  }

  /**
   * L'EXÉCUTION PAR LA FACTURE · la part de chaque ligne budgétaire, déclarée.
   * Dans l'exercice du bon, elle pose le rattachement de l'engagement (la
   * dépense quitte la colonne Engagement en entrant au 40) ; dans un exercice
   * POSTÉRIEUR, elle réduit le reste à facturer du bon et laisse l'engagement
   * de l'exercice du bon tel qu'il était à sa clôture (le tableau est établi
   * exercice par exercice, et le bon y était non exécuté).
   */
  async executer(tenantId: string, userId: string, id: string, dto: ExecuterBonCommandeDto) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrou(tx, tenantId);
      const bon = await tx.bonCommandeFournisseur.findFirst({
        where: { id, tenantId },
        include: {
          exercice: { select: { id: true, statut: true, dateDebut: true, dateFin: true } },
          lignes: { select: { sectionId: true, montantHT: true, montantTva: true, section: { select: { code: true } } } },
          executions: { select: { sectionId: true, montant: true, factureId: true } },
          engagements: { select: { id: true, sectionId: true, statut: true, montant: true, executions: { select: { montant: true } } } },
        },
      });
      if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
      if (bon.statut !== StatutBonCommande.REMIS) {
        throw new BadRequestException(
          bon.statut === StatutBonCommande.BROUILLON
            ? "Ce bon n'a pas été remis au fournisseur · il n'engage rien, aucune facture ne l'exécute."
            : 'Ce bon est clos · rouvrez-le avant de lui rattacher une facture.',
        );
      }
      if (bon.executions.some((e) => e.factureId === dto.factureId)) {
        throw new ConflictException('Cette facture exécute déjà ce bon · retirez-la d’abord pour déclarer d’autres parts.');
      }
      const facture = await tx.facture.findFirst({
        where: { id: dto.factureId, tenantId },
        select: {
          id: true,
          sens: true,
          nature: true,
          tiersId: true,
          numeroSerie: true,
          dateFacture: true,
          autresImpotsEtTaxes: true,
          noteDeCredit: { select: { id: true } },
          lignes: { select: { montantHT: true, montantTva: true } },
          executionsBonCommande: { select: { montant: true } },
          ecriture: { select: { id: true, statut: true, exerciceId: true, numeroPiece: true, exercice: { select: { dateDebut: true } } } },
        },
      });
      if (!facture) throw new NotFoundException('Facture introuvable dans ce dossier.');
      if (facture.sens !== SensFacture.ACHAT || facture.nature !== NatureFacture.FACTURE) {
        throw new BadRequestException('Seule une facture d’ACHAT exécute un bon de commande fournisseur.');
      }
      if (facture.tiersId !== bon.tiersId) {
        throw new BadRequestException(`La facture ${facture.numeroSerie} n'est pas celle du fournisseur du bon · un bon ne s'exécute que par les factures de son fournisseur.`);
      }
      if (facture.noteDeCredit) {
        throw new BadRequestException(`La facture ${facture.numeroSerie} est annulée par une note de crédit · elle n'exécute plus rien.`);
      }
      // SEULE UNE FACTURE AU LIVRE-JOURNAL EXÉCUTE (même règle que le registre,
      // audit final F140) · le tableau d'exécution budgétaire ne lit que le
      // validé, et une facture au brouillard ferait baisser l'engagement sans
      // que la dépense paraisse au 40.
      if (!facture.ecriture || facture.ecriture.statut !== StatutEcriture.VALIDEE) {
        throw new BadRequestException(
          `La facture ${facture.numeroSerie} n'est pas encore passée au journal et validée · passez-la (Facturation), validez l'écriture, puis rattachez-la.`,
        );
      }
      const ecriture = facture.ecriture;
      const memeExercice = ecriture.exerciceId === bon.exerciceId;
      if (!memeExercice && ecriture.exercice.dateDebut.getTime() < bon.exercice.dateDebut.getTime()) {
        throw new BadRequestException(`La facture ${facture.numeroSerie} est passée dans un exercice antérieur au bon · une commande ne s'exécute pas avant d'avoir été remise.`);
      }
      if (memeExercice && bon.exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(MOTIF_EXERCICE_BUDGETAIRE_CLOS);

      const engage = engageParSection(bon.lignes.map((l) => ({ sectionId: l.sectionId, montantHTCentimes: enCentimes(l.montantHT), montantTvaCentimes: enCentimes(l.montantTva) })));
      const reste = resteParSection(engage, bon.executions.map((e) => ({ sectionId: e.sectionId, montantCentimes: enCentimes(e.montant) })));
      const codes = new Map(bon.lignes.map((l) => [l.sectionId, l.section.code]));
      const parts = dto.parts.map((p) => {
        const c = enCentimesExacts(p.montant);
        return { sectionId: p.sectionId, montantCentimes: c ?? Number.NaN };
      });
      const motif = motifRefusParts(parts, reste, (s) => codes.get(s) ?? s);
      if (motif) throw new BadRequestException(motif);

      // UNE FACTURE NE S'EXÉCUTE PAS AU-DELÀ D'ELLE-MÊME · le cumul de ses parts,
      // tous bons confondus, reste borné à son total toutes taxes (le montant
      // que la fiche du compte 40 porte au crédit du fournisseur).
      const ttc = ttcDeLaFacture(facture);
      const dejaServi = facture.executionsBonCommande.reduce((s, e) => s + enCentimes(e.montant), 0);
      const nouveau = parts.reduce((s, p) => s + p.montantCentimes, 0);
      if (dejaServi + nouveau > ttc) {
        throw new BadRequestException(
          `La facture ${facture.numeroSerie} porte ${francs(ttc)} toutes taxes et exécute déjà ${francs(dejaServi)} d'autres bons · ` +
            `${francs(nouveau)} de plus la feraient servir au-delà d'elle-même.`,
        );
      }

      const avertissements: string[] = [];
      if (jour(facture.dateFacture) < (bon.dateRemise ? jour(bon.dateRemise) : '')) {
        avertissements.push(`La facture est datée du ${jourFr(jour(facture.dateFacture))}, avant la remise du bon · vérifiez qu'elle porte bien sur cette commande.`);
      }
      if (memeExercice) {
        // Le même plafond que le registre · le cumul des rattachements de la
        // pièce, bons et registre confondus, borné au total de ses débits.
        const [surLaPiece, debits] = await Promise.all([
          tx.executionEngagement.aggregate({ where: { ecritureId: ecriture.id, engagement: { tenantId } }, _sum: { montant: true } }),
          tx.ligneEcriture.aggregate({ where: { ecritureId: ecriture.id, ecriture: { statut: StatutEcriture.VALIDEE } }, _sum: { debit: true } }),
        ]);
        const rattache = enCentimes(surLaPiece._sum.montant ?? 0);
        if (rattache + nouveau > enCentimes(debits._sum.debit ?? 0)) {
          throw new BadRequestException(
            `La pièce ${ecriture.numeroPiece ?? ''} porte ${francs(enCentimes(debits._sum.debit ?? 0))} et en exécute déjà ${francs(rattache)} ` +
              `au registre des engagements · ${francs(nouveau)} de plus la feraient servir au-delà d'elle-même.`,
          );
        }
      } else {
        avertissements.push(
          "La facture est passée dans un exercice postérieur au bon · le reste à facturer baisse, l'engagement de l'exercice du bon reste tel qu'il était à sa clôture (le tableau est établi exercice par exercice).",
        );
      }

      for (const p of parts) {
        let executionEngagementId: string | null = null;
        if (memeExercice) {
          const eng = bon.engagements.find((e) => e.sectionId === p.sectionId);
          if (!eng || eng.statut !== StatutEngagement.OUVERT) {
            throw new ConflictException(`L'engagement de la ligne ${codes.get(p.sectionId)} n'est pas ouvert · rechargez le bon.`);
          }
          const exe = await tx.executionEngagement.create({
            data: { engagementId: eng.id, ecritureId: ecriture.id, montant: decimal(p.montantCentimes), createdBy: userId },
          });
          executionEngagementId = exe.id;
        }
        await tx.executionBonCommande.create({
          data: {
            tenantId,
            bonId: id,
            factureId: facture.id,
            sectionId: p.sectionId,
            montant: decimal(p.montantCentimes),
            executionEngagementId,
            createdBy: userId,
          },
        });
      }
      return { executee: true, avertissements };
    });
  }

  /**
   * Retirer une facture rattachée par erreur · ses parts et les rattachements
   * d'engagement qu'elles ont posés, ensemble. Refusé quand l'exercice où le
   * rattachement pèse est clôturé (le tableau d'un exercice arrêté ne change plus).
   */
  async retirerFacture(tenantId: string, id: string, factureId: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrou(tx, tenantId);
      const bon = await tx.bonCommandeFournisseur.findFirst({ where: { id, tenantId }, select: { id: true, statut: true, exercice: { select: { statut: true } } } });
      if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
      const parts = await tx.executionBonCommande.findMany({ where: { tenantId, bonId: id, factureId }, select: { id: true, executionEngagementId: true } });
      if (parts.length === 0) throw new NotFoundException("Cette facture n'exécute pas ce bon.");
      if (parts.some((p) => p.executionEngagementId) && bon.exercice.statut === StatutExercice.CLOTURE) {
        throw new BadRequestException(MOTIF_EXERCICE_BUDGETAIRE_CLOS);
      }
      for (const p of parts) {
        await tx.executionBonCommande.delete({ where: { id: p.id } });
        if (p.executionEngagementId) await tx.executionEngagement.delete({ where: { id: p.executionEngagementId } });
      }
      return { retiree: true };
    });
  }

  /**
   * CLORE UN BON REMIS · commande annulée, ou soldée en moins de ce qui était
   * commandé. Ses engagements sont clos avec le même motif dans l'exercice
   * ouvert ; dans un exercice clôturé, le bon se clôt seul et ses engagements
   * restent ce que le tableau arrêté a lu.
   */
  async clore(tenantId: string, userId: string, id: string, dto: CloreBonCommandeDto) {
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException('Le motif de clôture est exigé · il libère du crédit disponible, et le bailleur doit pouvoir savoir pourquoi.');
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrou(tx, tenantId);
      const bon = await tx.bonCommandeFournisseur.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          statut: true,
          exercice: { select: { statut: true } },
          engagements: { select: { id: true, statut: true } },
          executions: { where: { executionEngagementId: null }, select: { facture: { select: { numeroSerie: true } } } },
        },
      });
      if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
      if (bon.statut !== StatutBonCommande.REMIS) {
        throw new BadRequestException(bon.statut === StatutBonCommande.CLOS ? 'Ce bon est déjà clos.' : 'Un brouillon ne se clôt pas · il se supprime.');
      }
      // UNE FACTURE D'UN EXERCICE POSTÉRIEUR, EXERCICE DU BON ENCORE OUVERT
      // (relecture M5) · la part qu'elle couvre était commandée et non
      // exécutée à la clôture de l'exercice du bon, et doit peser sur son
      // tableau (règle (d) de l'Application 22) ; clore les engagements
      // l'effacerait avec le reste. Un engagement ne se clôt pas en partie ·
      // le geste attend la clôture de l'exercice du bon, après laquelle le bon
      // se clôt seul et ses engagements restent ce que le tableau arrêté a lu.
      if (bon.exercice.statut !== StatutExercice.CLOTURE && bon.executions.length > 0) {
        const nums = [...new Set(bon.executions.map((e) => e.facture.numeroSerie))].join(', ');
        throw new BadRequestException(
          `Le bon est exécuté en partie par la facture ${nums} d'un exercice postérieur, alors que l'exercice du bon est encore ouvert · ` +
            "le clore fermerait aussi la part que cette facture couvre, qui doit peser sur le tableau de l'exercice du bon. " +
            "Clôturez d'abord l'exercice du bon (le bon se clôt alors seul, sans toucher ses engagements), ou retirez cette facture du bon.",
        );
      }
      await tx.bonCommandeFournisseur.update({ where: { id }, data: { statut: StatutBonCommande.CLOS, motifCloture: motif, closLe: new Date(), closPar: userId } });
      const exerciceOuvert = bon.exercice.statut !== StatutExercice.CLOTURE;
      if (exerciceOuvert) {
        for (const e of bon.engagements) {
          if (e.statut === StatutEngagement.OUVERT) {
            await tx.engagementDepense.update({ where: { id: e.id }, data: { statut: StatutEngagement.CLOS, motifCloture: `Bon de commande clos · ${motif}` } });
          }
        }
      }
      return { clos: true, engagementsClos: exerciceOuvert };
    });
  }

  /** Rouvrir un bon clos par erreur · ses engagements repèsent dans un exercice ouvert. */
  async rouvrir(tenantId: string, id: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrou(tx, tenantId);
      const bon = await tx.bonCommandeFournisseur.findFirst({
        where: { id, tenantId },
        select: { id: true, statut: true, exercice: { select: { statut: true } }, engagements: { select: { id: true, statut: true } } },
      });
      if (!bon) throw new NotFoundException('Bon de commande introuvable dans ce dossier.');
      if (bon.statut !== StatutBonCommande.CLOS) throw new BadRequestException("Ce bon n'est pas clos.");
      if (bon.exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(MOTIF_EXERCICE_BUDGETAIRE_CLOS);
      await tx.bonCommandeFournisseur.update({ where: { id }, data: { statut: StatutBonCommande.REMIS, motifCloture: null, closLe: null, closPar: null } });
      for (const e of bon.engagements) {
        if (e.statut === StatutEngagement.CLOS) await tx.engagementDepense.update({ where: { id: e.id }, data: { statut: StatutEngagement.OUVERT, motifCloture: null } });
      }
      return { rouvert: true };
    });
  }
}

/** Le total toutes taxes d'une facture · lignes HT, taxe, autres impôts déclarés. */
export function ttcDeLaFacture(f: { lignes: { montantHT: unknown; montantTva: unknown }[]; autresImpotsEtTaxes: unknown }): number {
  const lignes = f.lignes.reduce((s, l) => s + enCentimes(l.montantHT as Prisma.Decimal) + enCentimes(l.montantTva as Prisma.Decimal), 0);
  return lignes + (f.autresImpotsEtTaxes === null || f.autresImpotsEtTaxes === undefined ? 0 : enCentimes(f.autresImpotsEtTaxes as Prisma.Decimal));
}

function regrouperParFacture(
  executions: {
    factureId: string;
    montant: Prisma.Decimal;
    executionEngagementId: string | null;
    section: { code: string };
    facture: { id: string; numeroSerie: string; dateFacture: Date; noteDeCredit: { numeroSerie: string } | null; ecriture: { id: string; exerciceId: string; numeroPiece: number | null } | null };
  }[],
) {
  const parFacture = new Map<string, { factureId: string; numeroSerie: string; dateFacture: string; numeroPiece: number | null; engagementExecute: boolean; barreePar: string | null; parts: { section: string; montant: number }[] }>();
  for (const e of executions) {
    const f = parFacture.get(e.factureId) ?? {
      factureId: e.factureId,
      numeroSerie: e.facture.numeroSerie,
      dateFacture: jour(e.facture.dateFacture),
      numeroPiece: e.facture.ecriture?.numeroPiece ?? null,
      engagementExecute: false,
      // UNE FACTURE BARRÉE SE DIT SUR LE BON (relecture M1) · la note de crédit
      // est refusée tant que la part se retire ; seule celle d'un exercice
      // clôturé, que le bon ne peut plus rendre, reste ici, nommée.
      barreePar: e.facture.noteDeCredit?.numeroSerie ?? null,
      parts: [],
    };
    f.parts.push({ section: e.section.code, montant: Number(e.montant) });
    if (e.executionEngagementId) f.engagementExecute = true;
    parFacture.set(e.factureId, f);
  }
  return [...parFacture.values()];
}
