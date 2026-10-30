import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutBulletinPaie } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { elementsEnFrancs } from './comptabilisation-paie';
import {
  RESERVE_RAPPEL,
  calculerRappel,
  libelleRappel,
  moisDuRappel,
  motifRefusMoisDePaiement,
  type BulletinSource,
  type CalculRappel,
  type LigneRappel,
} from './rappel-salaire';
import type { AnnulationRappelDto, RappelSalaireDto } from './dto/rappel-salaire.dto';

type Db = Pick<PrismaService, 'rappelSalaire' | 'bulletinPaie'> | Prisma.TransactionClient;

/** Une liste de travail · les plus récents d'abord, au-delà la tranche le dit. */
export const PLAFOND_RAPPELS = 200;

const objet = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' ? (x as Record<string, unknown>) : null);
const c = (n: number) => Math.round(n * 100);

/** Ce qu'un bulletin émis apporte au calcul · son salaire figé en francs, sa base figée, sa stipulation. */
export function sourceDuBulletin(b: { id: string; numero: number; moisDePaie: string; entree: unknown; calcul: unknown }): BulletinSource {
  const entree = objet(b.entree);
  const calcul = objet(b.calcul);
  const contrat = objet(calcul?.contrat);
  const elements = elementsEnFrancs(entree?.elements, objet(calcul?.conversion)) as
    | readonly { nature: string; montantFc: number; rappelId?: string }[]
    | null;
  const salaire = elements
    ? elements.filter((e) => e.nature === 'SALAIRE_OU_TRAITEMENT' && !e.rappelId).reduce((n, e) => n + c(e.montantFc), 0) / 100
    : null;
  return {
    id: b.id,
    numero: b.numero,
    moisDePaie: b.moisDePaie,
    salaireFc: salaire,
    base: typeof contrat?.remunerationBase === 'number' ? contrat.remunerationBase : null,
    periodicite: typeof contrat?.periodiciteRemuneration === 'string' ? contrat.periodiciteRemuneration : null,
    devise: typeof contrat?.deviseRemuneration === 'string' ? contrat.deviseRemuneration : null,
    stipuleEnDollars: entree?.deviseStipulation === 'USD',
  };
}

export type RappelPorte = { rappelId: string; totalFc: number; lignes: LigneRappel[]; motif: string };

/** Un rappel est porté tant que son bulletin est émis · annulé, le bulletin le libère. */
const porteurActif = (r: { bulletin: { statut: StatutBulletinPaie } | null }) => r.bulletin !== null && r.bulletin.statut === StatutBulletinPaie.EMIS;

/**
 * LES RAPPELS QU'UN BULLETIN PORTE, relus et REJOUÉS · lus dans le dossier,
 * du salarié payé, non annulés, non portés, payés un mois postérieur à tous
 * leurs mois · et chaque bulletin source encore émis, sans quoi le calcul
 * figé ne vaut plus (refus nommé, rien n'est porté).
 */
export async function rappelsAPorter(db: Db, tenantId: string, salarieId: string, moisDePaie: string, ids: readonly string[]): Promise<RappelPorte[]> {
  if (new Set(ids).size !== ids.length) throw new BadRequestException('Un même rappel figure deux fois au bulletin.');
  const rappels = await db.rappelSalaire.findMany({
    where: { tenantId, id: { in: [...ids] } },
    take: ids.length,
    include: { bulletin: { select: { statut: true, numero: true } } },
  });
  const portes: RappelPorte[] = [];
  for (const id of ids) {
    const r = rappels.find((x) => x.id === id);
    if (!r || r.salarieId !== salarieId) throw new BadRequestException('Rappel introuvable pour ce salarié · un bulletin ne porte que les rappels du salarié payé.');
    if (r.annuleLe) throw new BadRequestException(`Le rappel du ${r.createdAt.toISOString().slice(0, 10)} est annulé.`);
    if (porteurActif(r)) throw new BadRequestException(`Ce rappel est déjà payé par le bulletin n° ${r.bulletin!.numero} · annulez-le d'abord s'il est faux.`);
    const lignes = r.lignes as unknown as LigneRappel[];
    const refus = motifRefusMoisDePaiement(moisDePaie, lignes.map((l) => l.mois));
    if (refus) throw new BadRequestException(refus);
    const sources = await db.bulletinPaie.findMany({
      where: { tenantId, id: { in: lignes.map((l) => l.bulletinId) } },
      take: lignes.length,
      select: { id: true, numero: true, statut: true },
    });
    const tombes = lignes.filter((l) => sources.find((s) => s.id === l.bulletinId)?.statut !== StatutBulletinPaie.EMIS);
    if (tombes.length) {
      throw new BadRequestException(
        `Le rappel s'appuie sur le(s) bulletin(s) n° ${tombes.map((l) => l.numero).join(', ')}, annulé(s) depuis · le calcul figé ne vaut plus. Annulez ce rappel et déclarez-le de nouveau sur les bulletins réémis.`,
      );
    }
    portes.push({ rappelId: r.id, totalFc: Number(r.totalFc), lignes, motif: r.motif });
  }
  return portes;
}

/** Les éléments que les rappels ajoutent au bulletin · un par mois, nature « Salaire ou traitement », la note de la mention 13 au libellé. */
export function elementsDesRappels(portes: readonly RappelPorte[]) {
  return portes.flatMap((p) =>
    p.lignes.map((l) => ({ nature: 'SALAIRE_OU_TRAITEMENT' as const, libelle: libelleRappel(l.mois, p.motif), montantFc: l.arriereFc, rappelId: p.rappelId })),
  );
}

/**
 * Lie les rappels au bulletin, dans la transaction de l'émission · la ligne
 * du rappel prise `FOR UPDATE`, relue · porté ou annulé entre-temps, ou un
 * total qui a changé, et rien n'est émis (409).
 */
export async function lierRappelsAuBulletin(tx: Prisma.TransactionClient, tenantId: string, bulletinId: string, portes: readonly RappelPorte[]) {
  for (const p of portes) {
    await tx.$queryRaw`SELECT id FROM "rappels_salaire" WHERE id = ${p.rappelId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    const r = await tx.rappelSalaire.findFirst({
      where: { id: p.rappelId, tenantId },
      select: { id: true, annuleLe: true, totalFc: true, bulletin: { select: { statut: true, numero: true } } },
    });
    if (!r || r.annuleLe) throw new ConflictException("Un rappel a été annulé pendant l'émission · rien n'est émis.");
    if (porteurActif(r)) throw new ConflictException(`Un rappel a été payé entre-temps par le bulletin n° ${r.bulletin!.numero} · rien n'est émis.`);
    if (c(Number(r.totalFc)) !== c(p.totalFc)) throw new ConflictException("Un rappel a changé pendant l'émission · rien n'est émis. Relancez la simulation.");
    await tx.rappelSalaire.update({ where: { id: r.id }, data: { bulletinId } });
  }
}

/**
 * LIGNE PAIE-SUITE, FONCTION 87 · le rappel de salaires · simuler, déclarer
 * (le calcul REJOUÉ et figé), annuler, et dire ce qu'un bulletin peut porter.
 */
/**
 * UN BULLETIN SOURCE D'UN RAPPEL NON ANNULÉ NE S'ANNULE PAS (relecture
 * indépendante de la ligne, BLOQUANT) · l'arriéré a été calculé sur son
 * salaire figé ; annulé puis réémis au nouveau contrat, le mois porterait la
 * hausse ET le rappel la paierait encore · deux fois la même somme. Lu dans
 * la transaction de l'annulation, sous le verrou du salarié que la
 * déclaration d'un rappel prend aussi. Rend le motif du refus, ou null.
 */
export async function motifRefusAnnulationSourceDeRappel(
  tx: Prisma.TransactionClient,
  tenantId: string,
  bulletin: { id: string; salarieId: string; moisDePaie: string; numero: number },
): Promise<string | null> {
  const rappels = await tx.rappelSalaire.findMany({
    where: { tenantId, salarieId: bulletin.salarieId, annuleLe: null, moisDebut: { lte: bulletin.moisDePaie }, moisFin: { gte: bulletin.moisDePaie } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: PLAFOND_RAPPELS,
    select: { id: true, motif: true, moisDebut: true, moisFin: true, lignes: true, bulletin: { select: { numero: true, moisDePaie: true, statut: true } } },
  });
  const sources = rappels.filter((r) => (r.lignes as unknown as LigneRappel[]).some((l) => l.bulletinId === bulletin.id));
  if (sources.length === 0) return null;
  const noms = sources.map((r) => {
    const porteur =
      r.bulletin && r.bulletin.statut === StatutBulletinPaie.EMIS ? ` · payé par le bulletin n° ${r.bulletin.numero} de ${r.bulletin.moisDePaie}` : ' · pas encore payé';
    return `rappel « ${r.motif} » de ${r.moisDebut} à ${r.moisFin}${porteur}`;
  });
  return (
    `Le bulletin n° ${bulletin.numero} de ${bulletin.moisDePaie} est la base du ${noms.join(' ; ')} · annulé puis réémis, ` +
    "son mois porterait la hausse et le rappel la paierait une seconde fois. Annulez d'abord le bulletin qui paie le rappel (s'il est payé), " +
    'puis le rappel (Rappels de salaire), puis ce bulletin ; déclarez ensuite un rappel nouveau si un arriéré reste dû.'
  );
}

@Injectable()
export class RappelsSalaireService {
  constructor(private readonly prisma: PrismaService) {}

  private async calculer(tenantId: string, salarieId: string, dto: RappelSalaireDto): Promise<CalculRappel & { mois: string[] }> {
    const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const mois = moisDuRappel(dto.moisDebut, dto.moisFin);
    if ('refus' in mois) throw new BadRequestException(mois.refus);
    const [bulletins, rappels] = await Promise.all([
      this.prisma.bulletinPaie.findMany({
        where: { tenantId, salarieId, statut: StatutBulletinPaie.EMIS, moisDePaie: { in: mois } },
        orderBy: [{ moisDePaie: 'asc' }, { numero: 'asc' }],
        // Un bulletin actif par mois au plus (LIMITE_UN_BULLETIN_PAR_MOIS) · la borne le double.
        take: mois.length * 2,
        select: { id: true, numero: true, moisDePaie: true, entree: true, calcul: true },
      }),
      this.prisma.rappelSalaire.findMany({
        where: { tenantId, salarieId, annuleLe: null, moisFin: { gte: mois[0] }, moisDebut: { lte: mois[mois.length - 1] } },
        take: PLAFOND_RAPPELS,
        select: { createdAt: true, lignes: true },
      }),
    ]);
    const deja = new Map<string, string>();
    for (const r of rappels) {
      for (const l of r.lignes as unknown as LigneRappel[]) deja.set(l.mois, `déclaré le ${r.createdAt.toISOString().slice(0, 10)}`);
    }
    return {
      mois,
      ...calculerRappel(mois, bulletins.map(sourceDuBulletin), deja, { nouvelleBase: dto.nouvelleBase, periodicite: dto.periodicite, devise: dto.deviseBase }),
    };
  }

  /** Le calcul seul · rien d'écrit. */
  async simuler(tenantId: string, salarieId: string, dto: RappelSalaireDto) {
    const r = await this.calculer(tenantId, salarieId, dto);
    return { ...r, reserve: RESERVE_RAPPEL };
  }

  /**
   * DÉCLARER · le calcul est REJOUÉ ici et figé · un rappel sans aucun mois à
   * rappeler est refusé (rien à payer), et les mois exclus restent dits.
   */
  async creer(tenantId: string, userId: string, salarieId: string, dto: RappelSalaireDto) {
    const r = await this.calculer(tenantId, salarieId, dto);
    if (r.lignes.length === 0) {
      throw new BadRequestException({
        message: "Aucun mois du rappel ne porte d'arriéré · rien n'est déclaré.",
        motifs: r.exclus.map((e) => `${e.mois} · ${e.motif}`),
      });
    }
    // Deux déclarations simultanées sur le même mois · le verrou du salarié les range l'une derrière l'autre.
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "salaries" WHERE id = ${salarieId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const chevauchent = await tx.rappelSalaire.findMany({
        where: { tenantId, salarieId, annuleLe: null, moisFin: { gte: r.mois[0] }, moisDebut: { lte: r.mois[r.mois.length - 1] } },
        select: { lignes: true },
        take: PLAFOND_RAPPELS,
      });
      if (chevauchent.some((x) => (x.lignes as unknown as LigneRappel[]).some((l) => r.lignes.some((y) => y.mois === l.mois)))) {
        throw new ConflictException('Un rappel couvrant ces mois a été déclaré entre-temps · relancez la simulation.');
      }
      // Les bulletins sources relus SOUS le verrou · un bulletin annulé entre
      // le calcul et la déclaration ne fonde plus aucun arriéré.
      const sources = [...new Set(r.lignes.map((l) => l.bulletinId))];
      const encoreEmis = await tx.bulletinPaie.count({ where: { tenantId, id: { in: sources }, statut: StatutBulletinPaie.EMIS } });
      if (encoreEmis !== sources.length) {
        throw new ConflictException("Un bulletin d'un mois rappelé a été annulé entre-temps · relancez la simulation.");
      }
      return tx.rappelSalaire.create({
        data: {
          tenantId,
          salarieId,
          moisDebut: dto.moisDebut,
          moisFin: dto.moisFin,
          nouvelleBase: new Prisma.Decimal(dto.nouvelleBase),
          periodicite: dto.periodicite,
          deviseBase: dto.deviseBase,
          motif: dto.motif.trim(),
          pieceJustificative: dto.pieceJustificative.trim(),
          lignes: r.lignes as unknown as Prisma.InputJsonValue,
          exclus: r.exclus as unknown as Prisma.InputJsonValue,
          totalFc: new Prisma.Decimal(r.totalFc),
          creePar: userId,
        },
      });
    });
  }

  async lister(tenantId: string, salarieId?: string) {
    const [rappels, total] = await Promise.all([
      this.prisma.rappelSalaire.findMany({
        where: { tenantId, ...(salarieId ? { salarieId } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PLAFOND_RAPPELS,
        include: {
          salarie: { select: { nom: true, postNom: true, prenoms: true, matricule: true } },
          bulletin: { select: { numero: true, moisDePaie: true, statut: true } },
        },
      }),
      this.prisma.rappelSalaire.count({ where: { tenantId, ...(salarieId ? { salarieId } : {}) } }),
    ]);
    return {
      rappels: rappels.map((r) => ({
        id: r.id,
        salarieId: r.salarieId,
        salarie: [r.salarie.nom, r.salarie.postNom, r.salarie.prenoms].filter(Boolean).join(' '),
        moisDebut: r.moisDebut,
        moisFin: r.moisFin,
        nouvelleBase: Number(r.nouvelleBase),
        periodicite: r.periodicite,
        deviseBase: r.deviseBase,
        motif: r.motif,
        pieceJustificative: r.pieceJustificative,
        lignes: r.lignes as unknown as LigneRappel[],
        exclus: r.exclus as unknown as { mois: string; motif: string }[],
        totalFc: Number(r.totalFc),
        // Payé · le bulletin émis qui le porte ; un porteur annulé le libère.
        payePar: r.bulletin && r.bulletin.statut === StatutBulletinPaie.EMIS ? { numero: r.bulletin.numero, moisDePaie: r.bulletin.moisDePaie } : null,
        annuleLe: r.annuleLe,
        motifAnnulation: r.motifAnnulation,
        createdAt: r.createdAt,
      })),
      total,
      tronque: total > rappels.length,
      reserve: RESERVE_RAPPEL,
    };
  }

  /** Les rappels qu'un bulletin du mois peut payer · non annulés, non payés, tous leurs mois antérieurs. */
  async aPorter(tenantId: string, salarieId: string, moisDePaie: string) {
    const rappels = await this.prisma.rappelSalaire.findMany({
      where: { tenantId, salarieId, annuleLe: null, moisFin: { lt: moisDePaie } },
      orderBy: [{ createdAt: 'asc' }],
      take: PLAFOND_RAPPELS,
      include: { bulletin: { select: { statut: true } } },
    });
    return rappels
      .filter((r) => !porteurActif(r))
      .map((r) => ({ id: r.id, moisDebut: r.moisDebut, moisFin: r.moisFin, motif: r.motif, totalFc: Number(r.totalFc) }));
  }

  /** Annuler un rappel faux · motif exigé, refusé tant qu'un bulletin émis le paie. Une écriture unitaire, au journal d'audit. */
  async annuler(tenantId: string, userId: string, id: string, dto: AnnulationRappelDto) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "rappels_salaire" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const r = await tx.rappelSalaire.findFirst({
        where: { id, tenantId },
        select: { id: true, annuleLe: true, bulletin: { select: { statut: true, numero: true } } },
      });
      if (!r) throw new NotFoundException('Rappel introuvable dans ce dossier.');
      if (r.annuleLe) throw new ConflictException('Ce rappel est déjà annulé.');
      if (porteurActif(r)) throw new ConflictException(`Ce rappel est payé par le bulletin n° ${r.bulletin!.numero} · annulez d'abord le bulletin, qui le libère.`);
      return tx.rappelSalaire.update({ where: { id: r.id }, data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: dto.motif.trim() } });
    });
  }
}
