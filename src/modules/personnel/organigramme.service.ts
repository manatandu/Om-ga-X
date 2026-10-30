import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasa } from '../../common/echeance';
import { motifRefusClasseVentilee } from '../analytique/od-analytique';
import { CLASSE_DES_CHARGES_DE_PERSONNEL } from './ventilation-analytique-paie';
import {
  FONDEMENT_ORGANIGRAMME,
  PLAFOND_HISTORIQUE,
  PLAFOND_UNITES,
  deroulerArbre,
  formeUnCycle,
  motifRefusRattachement,
  motifRefusSuppressionUnite,
  motifRefusUnite,
  rattachementALaDate,
} from './organigramme';
import type { AnnulationRattachementDto, ModifierUniteOrganisationDto, RattachementUniteDto, UniteOrganisationDto } from './dto/organigramme.dto';

/** Le doublon d'une clé unique, même enveloppé par la transaction. */
function estDoublon(e: unknown): boolean {
  for (let x: unknown = e, n = 0; x && n < 5; x = (x as { cause?: unknown }).cause, n++) {
    if (x instanceof Prisma.PrismaClientKnownRequestError && x.code === 'P2002') return true;
  }
  return false;
}

const jour = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

/**
 * LIGNE PAIE-SUITE · DÉPARTEMENTS ET DIRECTIONS. Les règles sont dans
 * `organigramme.ts` ; ce service lit, écrit et relit sous verrou.
 *
 * UN SEUL VERROU, CELUI DU SALARIÉ, pour ses rattachements · deux saisies
 * simultanées à la même date ne passent pas toutes les deux (aucune contrainte
 * de base ne le peut, l'annulation laissant la ligne).
 */
@Injectable()
export class OrganigrammeService {
  constructor(private readonly prisma: PrismaService) {}

  /** L'organigramme déroulé, avec l'effectif de chaque unité au jour de Kinshasa. */
  async lister(tenantId: string) {
    const aujourdhui = jourDeKinshasa(new Date());
    const [unites, total, effectifs, plans, totalPlans] = await Promise.all([
      this.prisma.uniteOrganisation.findMany({
        where: { tenantId },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        take: PLAFOND_UNITES,
        select: {
          id: true,
          code: true,
          intitule: true,
          niveau: true,
          parentId: true,
          estActive: true,
          sectionAnalytiqueId: true,
          sectionAnalytique: { select: { code: true, intitule: true, estActive: true, plan: { select: { code: true } } } },
          _count: { select: { rattachements: true, enfants: true } },
        },
      }),
      this.prisma.uniteOrganisation.count({ where: { tenantId } }),
      this.effectifsAuJour(tenantId, aujourdhui),
      // Les sections qu'une unité peut proposer · servies ICI, le gestionnaire
      // de paie tenant le registre sans avoir l'analytique ouverte.
      this.prisma.planAnalytique.findMany({
        where: { tenantId, estActif: true },
        orderBy: [{ ordre: 'asc' }, { code: 'asc' }],
        take: 50,
        select: {
          code: true,
          classesVentilees: true,
          sections: {
            where: { type: TypeCompteDetailTotal.DETAIL, estActive: true },
            orderBy: { code: 'asc' },
            take: 500,
            select: { id: true, code: true, intitule: true },
          },
          // Le nombre réel · une liste coupée à 500 se DIT (`sectionsTronquees`).
          _count: { select: { sections: { where: { type: TypeCompteDetailTotal.DETAIL, estActive: true } } } },
        },
      }),
      this.prisma.planAnalytique.count({ where: { tenantId, estActif: true } }),
    ]);
    const niveaux = [...new Set(unites.map((u) => u.niveau).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b));
    return {
      aujourdhui: aujourdhui.toISOString().slice(0, 10),
      unites: deroulerArbre(unites).map((u) => ({
        id: u.id,
        code: u.code,
        intitule: u.intitule,
        niveau: u.niveau,
        parentId: u.parentId,
        estActive: u.estActive,
        profondeur: u.profondeur,
        chemin: u.chemin,
        orpheline: u.orpheline,
        section: u.sectionAnalytique
          ? { id: u.sectionAnalytiqueId, code: u.sectionAnalytique.code, intitule: u.sectionAnalytique.intitule, plan: u.sectionAnalytique.plan.code, estActive: u.sectionAnalytique.estActive }
          : null,
        effectifAuJour: effectifs.get(u.id) ?? 0,
        rattachements: u._count.rattachements,
        enfants: u._count.enfants,
      })),
      // Les niveaux que le dossier a déjà nommés · proposés à la saisie, jamais imposés.
      niveaux,
      sectionsProposables: plans
        .filter((p) => motifRefusClasseVentilee(CLASSE_DES_CHARGES_DE_PERSONNEL, p.classesVentilees) === null)
        .flatMap((p) => p.sections.map((x) => ({ id: x.id, code: x.code, intitule: x.intitule, plan: p.code }))),
      // Plans au-delà de 50 ou sections au-delà de 500 par plan · la liste
      // proposée est coupée, et l'écran le dit (jamais « aucune section »).
      sectionsTronquees: totalPlans > plans.length || plans.some((p) => p._count.sections > p.sections.length),
      total,
      tronque: total > unites.length,
      fondement: FONDEMENT_ORGANIGRAMME,
    };
  }

  /**
   * L'EFFECTIF DE CHAQUE UNITÉ AU JOUR · le dernier rattachement non annulé de
   * chaque salarié actif, au plus tard ce jour-là, demandé à la base (§ 8 bis ·
   * jamais une boucle sur des lignes rapatriées). La borne du dossier est
   * écrite deux fois, sur les deux tables.
   */
  private async effectifsAuJour(tenantId: string, date: Date): Promise<Map<string, number>> {
    const lignes = await this.prisma.$queryRaw<{ uniteId: string; n: bigint }[]>`
      SELECT d."uniteId", COUNT(*)::bigint AS n FROM (
        SELECT DISTINCT ON (r."salarieId") r."salarieId", r."uniteId"
        FROM "rattachements_unite" r
        JOIN "salaries" s ON s.id = r."salarieId" AND s."tenantId" = ${tenantId}
        WHERE r."tenantId" = ${tenantId} AND r."annuleLe" IS NULL AND r."dateEffet" <= ${date} AND s.actif = true
        ORDER BY r."salarieId", r."dateEffet" DESC, r."createdAt" DESC
      ) d GROUP BY d."uniteId"`;
    return new Map(lignes.map((l) => [l.uniteId, Number(l.n)]));
  }

  /**
   * LA SECTION QU'UNE UNITÉ PROPOSE · une section Détail active, d'un plan
   * actif de ce dossier qui ventile les charges de personnel · sinon la
   * répartition de la paie ne pourrait pas la recevoir, et la proposition
   * serait refusée au moment où on la suit.
   */
  private async verifierSection(tenantId: string, sectionId: string | null | undefined) {
    if (!sectionId) return;
    const s = await this.prisma.sectionAnalytique.findFirst({
      where: { id: sectionId, tenantId },
      select: { code: true, type: true, estActive: true, plan: { select: { code: true, estActif: true, classesVentilees: true } } },
    });
    if (!s) throw new NotFoundException('Section analytique introuvable dans ce dossier.');
    if (s.type !== TypeCompteDetailTotal.DETAIL) throw new BadRequestException(`La section ${s.code} est une rubrique (Total) · seule une section Détail reçoit la paie.`);
    if (!s.estActive || !s.plan.estActif) throw new BadRequestException(`La section ${s.code} ou son plan ${s.plan.code} est inactif.`);
    const refus = motifRefusClasseVentilee(CLASSE_DES_CHARGES_DE_PERSONNEL, s.plan.classesVentilees);
    if (refus) throw new BadRequestException(`Plan ${s.plan.code} · ${refus} La section d'une unité est proposée à la répartition de la paie, qui ventile les charges de personnel.`);
  }

  private async verifierParent(tenantId: string, uniteId: string | null, parentId: string | null | undefined) {
    if (!parentId) return;
    const unites = await this.prisma.uniteOrganisation.findMany({
      where: { tenantId },
      select: { id: true, parentId: true, code: true, estActive: true },
      take: PLAFOND_UNITES + 1,
    });
    if (unites.length > PLAFOND_UNITES) {
      throw new ConflictException(`L'organigramme dépasse ${PLAFOND_UNITES} unités · la parente ne se vérifie plus d'un coup, et rien n'est changé.`);
    }
    const parent = unites.find((u) => u.id === parentId);
    if (!parent) throw new NotFoundException('Unité parente introuvable dans ce dossier.');
    if (uniteId && formeUnCycle(uniteId, parentId, new Map(unites.map((u) => [u.id, u.parentId])))) {
      throw new BadRequestException(`Placer cette unité sous ${parent.code} ferait une boucle · une unité ne se range pas sous l'une de ses propres filles.`);
    }
  }

  async creer(tenantId: string, creePar: string, dto: UniteOrganisationDto) {
    const refus = motifRefusUnite(dto);
    if (refus) throw new BadRequestException(refus);
    await this.verifierParent(tenantId, null, dto.parentId);
    await this.verifierSection(tenantId, dto.sectionAnalytiqueId);
    const code = dto.code.trim().toUpperCase();
    try {
      return await this.prisma.uniteOrganisation.create({
        data: {
          tenantId,
          code,
          intitule: dto.intitule.trim(),
          niveau: dto.niveau?.trim() || null,
          parentId: dto.parentId ?? null,
          sectionAnalytiqueId: dto.sectionAnalytiqueId ?? null,
          creePar,
        },
      });
    } catch (e) {
      if (estDoublon(e)) throw new ConflictException(`Le code ${code} est déjà pris dans l'organigramme de ce dossier.`);
      throw e;
    }
  }

  /** Le code ne change pas · c'est lui que l'historique des salariés nomme. Une opération unitaire, au journal d'audit. */
  async modifier(tenantId: string, id: string, dto: ModifierUniteOrganisationDto) {
    const u = await this.prisma.uniteOrganisation.findFirst({ where: { id, tenantId }, select: { id: true, code: true, intitule: true, niveau: true } });
    if (!u) throw new NotFoundException('Unité introuvable dans ce dossier.');
    const refus = motifRefusUnite({ code: u.code, intitule: dto.intitule ?? u.intitule, niveau: dto.niveau === undefined ? u.niveau : dto.niveau });
    if (refus) throw new BadRequestException(refus);
    if (dto.parentId !== undefined) await this.verifierParent(tenantId, u.id, dto.parentId);
    if (dto.sectionAnalytiqueId !== undefined) await this.verifierSection(tenantId, dto.sectionAnalytiqueId);
    return this.prisma.uniteOrganisation.update({
      where: { id: u.id },
      data: {
        ...(dto.intitule !== undefined ? { intitule: dto.intitule.trim() } : {}),
        ...(dto.niveau !== undefined ? { niveau: dto.niveau?.trim() || null } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.sectionAnalytiqueId !== undefined ? { sectionAnalytiqueId: dto.sectionAnalytiqueId } : {}),
        ...(dto.estActive !== undefined ? { estActive: dto.estActive } : {}),
      },
    });
  }

  /** Une unité ne se supprime que vierge · sinon elle se met en sommeil (organigramme.ts). */
  async supprimer(tenantId: string, id: string) {
    const u = await this.prisma.uniteOrganisation.findFirst({
      where: { id, tenantId },
      select: { id: true, code: true, _count: { select: { rattachements: true, enfants: true } } },
    });
    if (!u) throw new NotFoundException('Unité introuvable dans ce dossier.');
    const refus = motifRefusSuppressionUnite({ code: u.code, rattachements: u._count.rattachements, enfants: u._count.enfants });
    if (refus) throw new ConflictException(refus);
    await this.prisma.uniteOrganisation.delete({ where: { id: u.id } });
    return { supprime: true };
  }

  /** L'historique d'un salarié, du plus récent au plus ancien, annulés compris, et son unité au jour. */
  async historique(tenantId: string, salarieId: string) {
    const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const [lignes, total] = await Promise.all([
      this.prisma.rattachementUnite.findMany({
        where: { tenantId, salarieId },
        orderBy: [{ dateEffet: 'desc' }, { createdAt: 'desc' }],
        take: PLAFOND_HISTORIQUE,
        select: {
          id: true,
          uniteId: true,
          dateEffet: true,
          creePar: true,
          createdAt: true,
          annuleLe: true,
          motifAnnulation: true,
          unite: { select: { code: true, intitule: true, niveau: true } },
        },
      }),
      this.prisma.rattachementUnite.count({ where: { tenantId, salarieId } }),
    ]);
    const enVigueur = rattachementALaDate(lignes, jourDeKinshasa(new Date()));
    return {
      rattachements: lignes.map((l) => ({
        id: l.id,
        uniteId: l.uniteId,
        unite: l.unite,
        dateEffet: l.dateEffet.toISOString().slice(0, 10),
        creePar: l.creePar,
        createdAt: l.createdAt,
        annuleLe: l.annuleLe,
        motifAnnulation: l.motifAnnulation,
        enVigueur: enVigueur?.id === l.id,
      })),
      total,
      tronque: total > lignes.length,
    };
  }

  /** Rattacher · relu sous le verrou du salarié, dans la transaction, puis écrit. */
  async rattacher(tenantId: string, creePar: string, salarieId: string, dto: RattachementUniteDto) {
    const dateEffet = jour(dto.dateEffet);
    return transactionJournalisee(this.prisma, async (tx) => {
      const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "salaries" WHERE id = ${salarieId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      if (verrou.length === 0) throw new NotFoundException('Salarié introuvable dans ce dossier.');
      const unite = await tx.uniteOrganisation.findFirst({ where: { id: dto.uniteId, tenantId }, select: { id: true, code: true, estActive: true } });
      if (!unite) throw new NotFoundException('Unité introuvable dans ce dossier.');
      const existants = await tx.rattachementUnite.findMany({
        where: { tenantId, salarieId },
        select: { id: true, uniteId: true, dateEffet: true, annuleLe: true },
        take: PLAFOND_HISTORIQUE + 1,
      });
      if (existants.length > PLAFOND_HISTORIQUE) {
        throw new ConflictException(`Ce salarié porte plus de ${PLAFOND_HISTORIQUE} rattachements · l'historique ne se relit plus d'un coup, et rien n'est enregistré.`);
      }
      const refus = motifRefusRattachement(unite, dateEffet, existants, unite.id);
      if (refus) throw new BadRequestException(refus);
      return tx.rattachementUnite.create({ data: { tenantId, salarieId, uniteId: unite.id, dateEffet, creePar } });
    });
  }

  /** Annuler une saisie fausse · motif exigé, la ligne reste lue. Une opération unitaire, au journal d'audit. */
  async annulerRattachement(tenantId: string, annulePar: string, id: string, dto: AnnulationRattachementDto) {
    // Relu sous le verrou de la ligne · deux annulations simultanées ne
    // passent pas toutes les deux, et l'`update` unitaire laisse au journal
    // d'audit l'état antérieur (un `updateMany` n'y laisserait que filtre et compte).
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "rattachements_unite" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const r = await tx.rattachementUnite.findFirst({ where: { id, tenantId }, select: { id: true, annuleLe: true } });
      if (!r) throw new NotFoundException('Rattachement introuvable dans ce dossier.');
      if (r.annuleLe) throw new ConflictException('Ce rattachement est déjà annulé.');
      await tx.rattachementUnite.update({ where: { id: r.id }, data: { annuleLe: new Date(), annulePar, motifAnnulation: dto.motif.trim() } });
      return { annule: true };
    });
  }

  /**
   * L'UNITÉ D'UN SALARIÉ AU JOUR, et la section qu'elle propose · lue par la
   * répartition analytique de la paie (fonction 88), qui la PROPOSE, jamais
   * ne l'impose. `null` sans rattachement, ou sans section active.
   */
  async propositionAnalytique(tenantId: string, salarieId: string) {
    const lignes = await this.prisma.rattachementUnite.findMany({
      where: { tenantId, salarieId, annuleLe: null, dateEffet: { lte: jourDeKinshasa(new Date()) } },
      orderBy: [{ dateEffet: 'desc' }, { createdAt: 'desc' }],
      take: 1,
      select: {
        unite: {
          select: {
            code: true,
            intitule: true,
            sectionAnalytique: { select: { id: true, code: true, intitule: true, estActive: true, planId: true, plan: { select: { estActif: true } } } },
          },
        },
      },
    });
    const u = lignes[0]?.unite ?? null;
    if (!u) return null;
    const s = u.sectionAnalytique;
    return {
      unite: { code: u.code, intitule: u.intitule },
      section: s && s.estActive && s.plan.estActif ? { id: s.id, code: s.code, intitule: s.intitule, planId: s.planId } : null,
      motif: !s
        ? `L'unité ${u.code} ne renvoie à aucune section analytique.`
        : !s.estActive || !s.plan.estActif
          ? `La section ${s.code} de l'unité ${u.code} est inactive · rien n'est proposé.`
          : `Section de l'unité ${u.code} (${u.intitule}) · proposée, jamais imposée.`,
    };
  }
}
