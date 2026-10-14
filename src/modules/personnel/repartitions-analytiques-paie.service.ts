import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { motifRefusClasseVentilee } from '../analytique/od-analytique';
import {
  CLASSE_DES_CHARGES_DE_PERSONNEL,
  motifRefusRepartition,
  type PlanConnu,
  type SectionConnue,
  type VersionRepartition,
} from './ventilation-analytique-paie';
import type { RepartitionAnalytiquePaieDto } from './dto/repartition-analytique-paie.dto';

/** Bornes de lecture · un dossier tient une poignée de plans, et un salarié quelques versions. */
export const PLAFOND_PLANS_LUS = 50;
export const PLAFOND_SECTIONS_PAR_PLAN = 500;
export const PLAFOND_VERSIONS_LUES = 200;
/** Toutes les versions en vigueur d'un mois, tous salariés · au-delà, la ventilation n'est pas proposée. */
export const PLAFOND_VERSIONS_DU_MOIS = 20_000;

/** Le doublon d'une clé unique, même enveloppé par la transaction. */
function estDoublon(e: unknown): boolean {
  for (let x: unknown = e, n = 0; x && n < 5; x = (x as { cause?: unknown }).cause, n++) {
    if (x instanceof Prisma.PrismaClientKnownRequestError && x.code === 'P2002') return true;
  }
  return false;
}

const versionLue = (v: {
  id: string;
  salarieId: string;
  planId: string;
  moisEffet: string;
  lignes: { sectionId: string; pourcentage: Prisma.Decimal | number }[];
}): VersionRepartition => ({
  id: v.id,
  salarieId: v.salarieId,
  planId: v.planId,
  moisEffet: v.moisEffet,
  lignes: v.lignes.map((l) => ({ sectionId: l.sectionId, pourcentage: Number(l.pourcentage) })),
});

/**
 * LIGNE SAGE-L5, FONCTION 88 · LA RÉPARTITION ANALYTIQUE DU SALARIÉ, tenue
 * au registre du personnel. Les règles sont dans
 * `ventilation-analytique-paie.ts` ; ce service lit, déclare, retire, et sert
 * à la passation du mois ce qu'elle applique.
 *
 * Les plans et leurs sections Détail sont servis ICI, avec la répartition · le
 * gestionnaire de paie tient le registre sans avoir l'analytique ouverte
 * (roles-cantonnes.ts), et la liste qu'il choisit doit être celle que la
 * règle admet.
 */
@Injectable()
export class RepartitionsAnalytiquesPaieService {
  constructor(private readonly prisma: PrismaService) {}

  private async salarie(tenantId: string, salarieId: string) {
    const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    return s;
  }

  async lire(tenantId: string, salarieId: string) {
    await this.salarie(tenantId, salarieId);
    const [plans, versions, total] = await Promise.all([
      this.prisma.planAnalytique.findMany({
        where: { tenantId, estActif: true },
        orderBy: [{ ordre: 'asc' }, { code: 'asc' }],
        take: PLAFOND_PLANS_LUS,
        select: {
          id: true,
          code: true,
          intitule: true,
          classesVentilees: true,
          sections: {
            where: { type: TypeCompteDetailTotal.DETAIL, estActive: true },
            orderBy: { code: 'asc' },
            take: PLAFOND_SECTIONS_PAR_PLAN + 1,
            select: { id: true, code: true, intitule: true },
          },
        },
      }),
      this.prisma.repartitionAnalytiquePaie.findMany({
        where: { tenantId, salarieId },
        orderBy: [{ moisEffet: 'desc' }, { createdAt: 'desc' }],
        take: PLAFOND_VERSIONS_LUES,
        select: {
          id: true,
          planId: true,
          moisEffet: true,
          createdAt: true,
          retireLe: true,
          motifRetrait: true,
          plan: { select: { code: true, intitule: true } },
          lignes: {
            orderBy: { section: { code: 'asc' } },
            select: { sectionId: true, pourcentage: true, section: { select: { code: true, intitule: true } } },
          },
        },
      }),
      this.prisma.repartitionAnalytiquePaie.count({ where: { tenantId, salarieId } }),
    ]);
    return {
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        intitule: p.intitule,
        // Un plan qui ne ventile pas les charges de personnel ne reçoit pas de
        // répartition · il est servi pour le dire, jamais proposé au choix.
        ventileLaPaie: motifRefusClasseVentilee(CLASSE_DES_CHARGES_DE_PERSONNEL, p.classesVentilees) === null,
        sections: p.sections.slice(0, PLAFOND_SECTIONS_PAR_PLAN),
        sectionsTronquees: p.sections.length > PLAFOND_SECTIONS_PAR_PLAN,
      })),
      plansTronques: plans.length === PLAFOND_PLANS_LUS,
      versions: versions.map((v) => ({
        id: v.id,
        planId: v.planId,
        planCode: v.plan.code,
        planIntitule: v.plan.intitule,
        moisEffet: v.moisEffet,
        createdAt: v.createdAt,
        retireLe: v.retireLe,
        motifRetrait: v.motifRetrait,
        lignes: v.lignes.map((l) => ({
          sectionId: l.sectionId,
          sectionCode: l.section.code,
          sectionIntitule: l.section.intitule,
          pourcentage: Number(l.pourcentage),
        })),
      })),
      total,
      tronque: total > versions.length,
    };
  }

  /**
   * DÉCLARER une version · rejouée ici sur le plan et les sections relus,
   * jamais crue du client. Une version du même mois, non retirée, refuse ·
   * une version ne se modifie pas, elle se retire puis se redéclare.
   */
  async declarer(tenantId: string, userId: string, salarieId: string, dto: RepartitionAnalytiquePaieDto) {
    await this.salarie(tenantId, salarieId);
    const [plan, sections] = await Promise.all([
      this.prisma.planAnalytique.findFirst({
        where: { id: dto.planId, tenantId },
        select: { id: true, code: true, classesVentilees: true, estActif: true },
      }),
      dto.lignes.length
        ? this.prisma.sectionAnalytique.findMany({
            where: { tenantId, id: { in: dto.lignes.map((l) => l.sectionId) } },
            select: { id: true, planId: true, code: true, type: true, estActive: true },
          })
        : Promise.resolve([]),
    ]);
    const connues: SectionConnue[] = sections.map((s) => ({
      id: s.id,
      planId: s.planId,
      code: s.code,
      estTotal: s.type === TypeCompteDetailTotal.TOTAL,
      estActive: s.estActive,
    }));
    const motif = motifRefusRepartition({ plan, sections: connues, lignes: dto.lignes, moisEffet: dto.moisEffet });
    if (motif) throw new BadRequestException(motif);
    const existante = await this.prisma.repartitionAnalytiquePaie.findFirst({
      where: { tenantId, salarieId, planId: dto.planId, moisEffet: dto.moisEffet, retireLe: null },
      select: { id: true },
    });
    const refusDoublon = () =>
      new ConflictException(
        `Une répartition sur le plan ${plan!.code} vaut déjà à partir de ${dto.moisEffet} · une version ne se modifie pas · ` +
          'retirez-la avec son motif, puis déclarez la nouvelle.',
      );
    if (existante) throw refusDoublon();
    try {
      return await this.prisma.repartitionAnalytiquePaie.create({
        data: {
          tenantId,
          salarieId,
          planId: dto.planId,
          moisEffet: dto.moisEffet,
          creePar: userId,
          lignes: {
            create: dto.lignes.map((l) => ({
              tenantId,
              sectionId: l.sectionId,
              pourcentage: new Prisma.Decimal(l.pourcentage.toFixed(2)),
            })),
          },
        },
        select: { id: true, moisEffet: true },
      });
    } catch (e) {
      // Deux déclarations simultanées · l'index unique (NULLS NOT DISTINCT)
      // tranche, la seconde reçoit le même refus que la lecture.
      if (estDoublon(e)) throw refusDoublon();
      throw e;
    }
  }

  /**
   * RETIRER une version, avec son motif · elle cesse de valoir pour les
   * passations à venir. Les écritures déjà passées gardent leur ventilation,
   * qui est la leur · on ventile une ligne déjà passée par « Ventilation
   * d'une ligne », jamais en rejouant une répartition.
   */
  async retirer(tenantId: string, userId: string, id: string, motif: string) {
    const v = await this.prisma.repartitionAnalytiquePaie.findFirst({
      where: { id, tenantId },
      select: { id: true, retireLe: true },
    });
    if (!v) throw new NotFoundException('Répartition introuvable dans ce dossier.');
    if (v.retireLe) throw new ConflictException('Cette répartition est déjà retirée.');
    // Mise à jour UNITAIRE · le journal d'audit garde la pré-image.
    return this.prisma.repartitionAnalytiquePaie.update({
      where: { id, tenantId },
      data: { retireLe: new Date(), retirePar: userId, motifRetrait: motif.trim() },
      select: { id: true, retireLe: true },
    });
  }

  /**
   * CE QUE LA PASSATION DU MOIS APPLIQUE · les plans actifs, les versions en
   * vigueur au mois (non retirées, mois d'effet au plus tard le mois) des
   * salariés nommés, et les sections qu'elles citent, telles qu'aujourd'hui
   * (une section passée en sommeil depuis se voit). `null` quand la lecture
   * dépasse sa borne · la ventilation n'est alors pas proposée, et c'est dit.
   */
  async pourLaPassation(
    tenantId: string,
    mois: string,
    salarieIds: readonly string[],
  ): Promise<{ plans: PlanConnu[]; sections: SectionConnue[]; versions: VersionRepartition[]; obligatoires: string[] } | null> {
    const plans = await this.prisma.planAnalytique.findMany({
      where: { tenantId, estActif: true },
      take: PLAFOND_PLANS_LUS,
      select: { id: true, code: true, classesVentilees: true, estActif: true, ventilationObligatoire: true },
    });
    if (plans.length === 0 || salarieIds.length === 0) {
      return { plans, sections: [], versions: [], obligatoires: plans.filter((p) => p.ventilationObligatoire).map((p) => p.code) };
    }
    const versions = await this.prisma.repartitionAnalytiquePaie.findMany({
      where: { tenantId, salarieId: { in: [...salarieIds] }, moisEffet: { lte: mois }, retireLe: null, planId: { in: plans.map((p) => p.id) } },
      take: PLAFOND_VERSIONS_DU_MOIS + 1,
      select: { id: true, salarieId: true, planId: true, moisEffet: true, lignes: { select: { sectionId: true, pourcentage: true } } },
    });
    if (versions.length > PLAFOND_VERSIONS_DU_MOIS) return null;
    const sectionIds = [...new Set(versions.flatMap((v) => v.lignes.map((l) => l.sectionId)))];
    const sections = sectionIds.length
      ? await this.prisma.sectionAnalytique.findMany({
          where: { tenantId, id: { in: sectionIds } },
          select: { id: true, planId: true, code: true, type: true, estActive: true },
        })
      : [];
    return {
      plans,
      sections: sections.map((s) => ({
        id: s.id,
        planId: s.planId,
        code: s.code,
        estTotal: s.type === TypeCompteDetailTotal.TOTAL,
        estActive: s.estActive,
      })),
      versions: versions.map(versionLue),
      obligatoires: plans.filter((p) => p.ventilationObligatoire).map((p) => p.code),
    };
  }
}
