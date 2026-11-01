import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutBulletinPaie } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { AnnulationMissionDto, FinMissionDto, FraisMissionDto, MissionSalarieDto } from './dto/missions.dto';
import {
  PLAFOND_FRAIS_PAR_MISSION,
  motifRefusForfaitAuMois,
  motifRefusFrais,
  motifRefusMission,
  sortDuFrais,
  totauxMission,
  type ElementFraisMission,
  type QualificationFraisMission,
} from './missions-salarie';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';
import { PLAFOND_REPARTITIONS_MISSION } from './avance-mission';

/** Liste de travail bornée (§ 8 bis) · elle dit quand elle ne couvre pas tout. */
export const PLAFOND_MISSIONS = 500;

type Db = PrismaService | Prisma.TransactionClient;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const jourUtc = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

/** Ce qu'un bulletin porte d'une mission, rejoué au serveur. */
export type MissionPortee = {
  readonly missionId: string;
  readonly numero: number;
  readonly destination: string;
  readonly forfaitFc: number;
  readonly justifieFc: number;
};

/** Un bulletin émis retient la mission ; annulé, il la rend. */
const porteurActif = (m: { bulletin: { statut: StatutBulletinPaie; numero: number } | null }) =>
  m.bulletin !== null && m.bulletin.statut === StatutBulletinPaie.EMIS;

const lireFrais = (frais: readonly { element: string; qualification: string; montantFc: Prisma.Decimal }[]) =>
  frais.map((f) => ({
    element: f.element as ElementFraisMission,
    qualification: f.qualification as QualificationFraisMission,
    montantFc: Number(f.montantFc),
  }));

/**
 * CE QUE LE BULLETIN PORTE D'UNE MISSION (ligne paie-declarations, point 3) ·
 * une mission qui a une AVANCE non annulée ne porte plus ses frais justifiés
 * au bulletin · la régularisation au retour les impute au 6384 contre
 * l'avance (`avance-mission.ts`), et les porter aussi au bulletin les ferait
 * rembourser deux fois. Le forfait, imposable (loi n° 23/053, art. 68, 1°),
 * reste au bulletin.
 */
export function totauxAuBulletin(frais: ReturnType<typeof lireFrais>, avancee: boolean) {
  const t = totauxMission(frais);
  return avancee ? { ...t, justifieFc: 0 } : t;
}

type AvanceLue = Prisma.AvanceMissionGetPayload<{ include: { regularisations: true } }>;

/** L'avance non annulée et sa régularisation non annulée · l'historique annulé reste compté. */
export function avanceDeLaMission(avances: readonly AvanceLue[]) {
  const a = avances.find((x) => x.annuleLe === null) ?? null;
  const annulees = avances.filter((x) => x.annuleLe !== null).length;
  if (!a) return { active: null, annulees };
  const r = a.regularisations.find((x) => x.annuleLe === null) ?? null;
  return {
    annulees,
    active: {
      id: a.id,
      date: iso(a.date),
      montantFc: Number(a.montantFc),
      pieceJustificative: a.pieceJustificative,
      piecePassee: a.piecePassee,
      regularisation: r
        ? {
            id: r.id,
            date: iso(r.date),
            issue: r.issue,
            justifieFc: Number(r.justifieFc),
            avanceFc: Number(r.avanceFc),
            ecartFc: Number(r.ecartFc),
            piecePassee: r.piecePassee,
            avanceSalaireId: r.avanceSalaireId,
          }
        : null,
    },
  };
}

/**
 * LES MISSIONS QU'UN BULLETIN PORTE, relues dans le dossier · chacune du
 * salarié payé, non annulée, jamais portée par un autre bulletin émis, d'un
 * départ qui ne suit pas le mois. Ce qui part au bulletin · le forfait (imposable)
 * et le remboursement sur pièces (hors impôt), jamais la dépense que l'entité a
 * réglée elle-même.
 */
export async function missionsAPorter(
  db: Db,
  tenantId: string,
  salarieId: string,
  moisDePaie: string,
  ids: readonly string[],
): Promise<MissionPortee[]> {
  if (new Set(ids).size !== ids.length) throw new BadRequestException('Une même mission figure deux fois au bulletin.');
  const missions = await db.missionSalarie.findMany({
    where: { tenantId, id: { in: [...ids] } },
    take: ids.length,
    include: {
      frais: { select: { element: true, qualification: true, montantFc: true } },
      bulletin: { select: { statut: true, numero: true } },
      avances: { where: { annuleLe: null }, select: { id: true }, take: 1 },
    },
  });
  const portees: MissionPortee[] = [];
  for (const id of ids) {
    const m = missions.find((x) => x.id === id);
    if (!m || m.salarieId !== salarieId) {
      throw new BadRequestException("Mission introuvable pour ce salarié · un bulletin ne porte que les missions du salarié payé.");
    }
    if (porteurActif(m)) {
      throw new BadRequestException(`La mission n° ${m.numero} est déjà portée par le bulletin n° ${m.bulletin!.numero} · annulez-le d'abord s'il est faux.`);
    }
    const t = totauxAuBulletin(lireFrais(m.frais), m.avances.length > 0);
    const refus = motifRefusForfaitAuMois(
      { numero: m.numero, dateDepart: m.dateDepart, annuleLe: m.annuleLe, aPorterFc: t.forfaitFc + t.justifieFc },
      moisDePaie,
    );
    if (refus) throw new BadRequestException(refus);
    portees.push({ missionId: m.id, numero: m.numero, destination: m.destination, forfaitFc: t.forfaitFc, justifieFc: t.justifieFc });
  }
  return portees;
}

/**
 * Lie les missions au bulletin, dans la transaction de l'émission, sous son
 * verrou. M1 DE LA RELECTURE · la simulation a lu les frais AVANT la
 * transaction ; un frais ajouté ou retiré entre-temps faisait figer au
 * bulletin 90 000 quand la mission en portait 120 000, et la mission, liée,
 * ne changeait plus. La ligne de la mission est prise `FOR UPDATE` (les
 * gestes sur ses frais prennent le même verrou), ses frais RELUS, et des
 * totaux qui diffèrent de ce que la simulation a porté refusent l'émission
 * en 409, rien n'étant émis.
 */
export async function lierMissionsAuBulletin(
  tx: Prisma.TransactionClient,
  tenantId: string,
  bulletinId: string,
  portees: readonly MissionPortee[],
) {
  for (const p of portees) {
    await verrouillerMission(tx, tenantId, p.missionId);
    const m = await tx.missionSalarie.findFirst({
      where: { id: p.missionId, tenantId },
      select: {
        id: true,
        numero: true,
        annuleLe: true,
        bulletin: { select: { statut: true, numero: true } },
        frais: { select: { element: true, qualification: true, montantFc: true } },
        avances: { where: { annuleLe: null }, select: { id: true }, take: 1 },
      },
    });
    if (!m || m.annuleLe) throw new ConflictException(`Mission n° ${p.numero} annulée pendant l'émission · rien n'est émis.`);
    if (porteurActif(m)) throw new ConflictException(`Mission n° ${p.numero} portée entre-temps par le bulletin n° ${m.bulletin!.numero} · rien n'est émis.`);
    // Une avance versée entre la simulation et l'émission retire les frais
    // justifiés du bulletin (la régularisation les impute) · la même règle
    // qu'au calcul, et l'écart refuse l'émission comme un frais changé.
    const t = totauxAuBulletin(lireFrais(m.frais), m.avances.length > 0);
    if (Math.round(t.forfaitFc * 100) !== Math.round(p.forfaitFc * 100) || Math.round(t.justifieFc * 100) !== Math.round(p.justifieFc * 100)) {
      throw new ConflictException(
        `Les frais de la mission n° ${p.numero} ont changé pendant l'émission (forfait ${t.forfaitFc}, remboursement ${t.justifieFc}, ` +
          `contre ${p.forfaitFc} et ${p.justifieFc} au calcul) · rien n'est émis. Relancez la simulation, puis émettez.`,
      );
    }
    await tx.missionSalarie.update({ where: { id: m.id }, data: { bulletinId } });
  }
}

/** Le verrou de la mission · l'émission et les gestes sur ses frais le prennent, dans le même ordre. */
async function verrouillerMission(tx: Prisma.TransactionClient, tenantId: string, missionId: string) {
  await prendreLeVerrouDuDossierBorne(tx, tenantId);
  await tx.$queryRaw`SELECT id FROM "missions_salarie" WHERE id = ${missionId} AND "tenantId" = ${tenantId} FOR UPDATE`;
}

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private presenter(m: Prisma.MissionSalarieGetPayload<{
    include: {
      salarie: { select: { nom: true; postNom: true; prenoms: true; matricule: true } };
      frais: true;
      bulletin: { select: { statut: true; numero: true; moisDePaie: true } };
      avances: { include: { regularisations: true } };
      repartitions: { include: { plan: { select: { code: true } }; section: { select: { code: true } } } };
    };
  }>) {
    const frais = m.frais.map((f) => ({
      id: f.id,
      element: f.element,
      qualification: f.qualification,
      montantFc: Number(f.montantFc),
      piece: f.piece,
      libelle: f.libelle,
      sort: sortDuFrais({ element: f.element as ElementFraisMission, qualification: f.qualification as QualificationFraisMission, montantFc: Number(f.montantFc) }),
    }));
    return {
      id: m.id,
      numero: m.numero,
      salarieId: m.salarieId,
      salarie: [m.salarie.nom, m.salarie.postNom, m.salarie.prenoms].filter(Boolean).join(' '),
      matricule: m.salarie.matricule,
      objet: m.objet,
      lieuDepart: m.lieuDepart,
      destination: m.destination,
      dateDepart: iso(m.dateDepart),
      dateRetour: iso(m.dateRetour),
      moyenTransport: m.moyenTransport,
      accomplieLe: m.accomplieLe ? iso(m.accomplieLe) : null,
      annuleLe: m.annuleLe,
      motifAnnulation: m.motifAnnulation,
      bulletin: m.bulletin && m.bulletin.statut === StatutBulletinPaie.EMIS ? { numero: m.bulletin.numero, moisDePaie: m.bulletin.moisDePaie } : null,
      // Le lien vers un bulletin ANNULÉ reste en base (l'émission suivante
      // l'écrase) · il ne retient plus la mission, et c'est dit, sans quoi
      // l'écran montrait une mission libre sans dire qu'elle avait été payée
      // par un bulletin depuis annulé.
      bulletinAnnule: m.bulletin && m.bulletin.statut !== StatutBulletinPaie.EMIS ? { numero: m.bulletin.numero, moisDePaie: m.bulletin.moisDePaie } : null,
      frais,
      totaux: totauxMission(lireFrais(m.frais)),
      // Ligne paie-declarations · l'avance non annulée et sa régularisation, et
      // ce que le bulletin porte encore (le forfait seul quand la mission est avancée).
      avance: avanceDeLaMission(m.avances),
      aPorterAuBulletin: totauxAuBulletin(lireFrais(m.frais), m.avances.some((a) => a.annuleLe === null)),
      // Au-delà du plafond, la liste se dit tronquée (la pose ne le permet pas).
      repartitionsTronquees: m.repartitions.length > PLAFOND_REPARTITIONS_MISSION,
      repartitions: m.repartitions.slice(0, PLAFOND_REPARTITIONS_MISSION).map((r) => ({
        planId: r.planId,
        planCode: r.plan.code,
        sectionId: r.sectionId,
        sectionCode: r.section.code,
        pourcentage: Number(r.pourcentage),
      })),
    };
  }

  private readonly inclure = {
    salarie: { select: { nom: true, postNom: true, prenoms: true, matricule: true } },
    frais: { orderBy: { createdAt: 'asc' as const }, take: PLAFOND_FRAIS_PAR_MISSION },
    bulletin: { select: { statut: true, numero: true, moisDePaie: true } },
    // Toutes les avances, annulées comprises (une mission en a au plus quelques-unes) · l'écran dit l'historique.
    avances: { orderBy: { createdAt: 'desc' as const }, take: 20, include: { regularisations: { orderBy: { createdAt: 'desc' as const }, take: 20 } } },
    repartitions: { orderBy: [{ planId: 'asc' as const }, { sectionId: 'asc' as const }], take: PLAFOND_REPARTITIONS_MISSION + 1, include: { plan: { select: { code: true } }, section: { select: { code: true } } } },
  };

  /** Les plus récentes d'abord, l'identifiant départageant un même jour. */
  async lister(tenantId: string, salarieId?: string) {
    const [missions, total] = await Promise.all([
      this.prisma.missionSalarie.findMany({
        where: { tenantId, ...(salarieId ? { salarieId } : {}) },
        orderBy: [{ dateDepart: 'desc' }, { id: 'desc' }],
        take: PLAFOND_MISSIONS,
        include: this.inclure,
      }),
      this.prisma.missionSalarie.count({ where: { tenantId, ...(salarieId ? { salarieId } : {}) } }),
    ]);
    return { missions: missions.map((m) => this.presenter(m)), total, plafond: PLAFOND_MISSIONS, tronque: total > missions.length };
  }

  /**
   * Les missions qu'un bulletin du mois peut porter · non annulées, non
   * portées par un bulletin émis, d'un départ qui ne suit pas le mois, et
   * qui portent un frais dû au travailleur.
   */
  async duMois(tenantId: string, salarieId: string, moisDePaie: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(moisDePaie)) throw new BadRequestException('Le mois de paie se lit AAAA-MM.');
    const dernierJour = new Date(Date.UTC(Number(moisDePaie.slice(0, 4)), Number(moisDePaie.slice(5, 7)), 0));
    const missions = await this.prisma.missionSalarie.findMany({
      where: { tenantId, salarieId, annuleLe: null, dateDepart: { lte: dernierJour } },
      orderBy: [{ dateDepart: 'asc' }, { id: 'asc' }],
      take: PLAFOND_MISSIONS,
      include: this.inclure,
    });
    return missions
      .filter((m) => !porteurActif(m))
      .map((m) => this.presenter(m))
      .filter((m) => m.aPorterAuBulletin.forfaitFc + m.aPorterAuBulletin.justifieFc > 0);
  }

  /** Le numéro se prend sous un verrou par dossier · deux ordres simultanés n'ont jamais le même. */
  async creer(tenantId: string, email: string, salarieId: string, dto: MissionSalarieDto) {
    const salarie = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
    if (!salarie) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const refus = motifRefusMission(dto);
    if (refus) throw new BadRequestException(refus);
    // Un ordre de mission se donne à un travailleur sous contrat · sans
    // contrat en vigueur au départ, ses frais ne trouveraient aucun bulletin
    // pour les porter (le bulletin exige un contrat en cours), et la mission
    // resterait en suspens sans que rien le dise.
    const depart = jourUtc(dto.dateDepart);
    const contrat = await this.prisma.contratTravail.findFirst({
      where: { tenantId, salarieId, dateEntreeEnVigueur: { lte: depart }, OR: [{ dateFin: null }, { dateFin: { gte: depart } }] },
      select: { id: true },
    });
    if (!contrat) {
      throw new BadRequestException(
        `Aucun contrat du salarié n'est en vigueur le ${dto.dateDepart.slice(0, 10)} · un ordre de mission se donne pendant le contrat. Enregistrez le contrat, ou corrigez la date de départ.`,
      );
    }
    const cree = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`missions:${tenantId}`}))`;
      const dernier = await tx.missionSalarie.aggregate({ where: { tenantId }, _max: { numero: true } });
      return tx.missionSalarie.create({
        data: {
          tenantId,
          salarieId,
          numero: (dernier._max.numero ?? 0) + 1,
          objet: dto.objet.trim(),
          lieuDepart: dto.lieuDepart?.trim() || null,
          destination: dto.destination.trim(),
          dateDepart: jourUtc(dto.dateDepart),
          dateRetour: jourUtc(dto.dateRetour),
          moyenTransport: dto.moyenTransport?.trim() || null,
          creePar: email,
        },
        select: { id: true },
      });
    });
    return this.lire(tenantId, cree.id);
  }

  async lire(tenantId: string, id: string) {
    const m = await this.prisma.missionSalarie.findFirst({ where: { id, tenantId }, include: this.inclure });
    if (!m) throw new NotFoundException('Mission introuvable dans ce dossier.');
    return this.presenter(m);
  }

  /**
   * UNE MISSION PORTÉE PAR UN BULLETIN ÉMIS NE CHANGE PLUS · le bulletin a
   * figé ce qu'elle portait (art. 103, décompte écrit) · annuler le bulletin
   * la rend. Une mission annulée ne change plus non plus.
   */
  private async modifiable(db: Db, tenantId: string, id: string) {
    const m = await db.missionSalarie.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        numero: true,
        annuleLe: true,
        dateDepart: true,
        bulletin: { select: { statut: true, numero: true } },
        _count: { select: { frais: true } },
        avances: { where: { annuleLe: null }, select: { regularisations: { where: { annuleLe: null }, select: { id: true }, take: 1 } }, take: 1 },
      },
    });
    if (!m) throw new NotFoundException('Mission introuvable dans ce dossier.');
    if (m.annuleLe) throw new ConflictException(`La mission n° ${m.numero} est annulée · elle ne change plus.`);
    // Ligne paie-declarations · la régularisation a FIGÉ les frais justifiés
    // qu'elle impute · un frais ajouté ou retiré après elle ne serait ni au
    // 6384 ni au bulletin. Annuler la régularisation rend la mission modifiable.
    if (m.avances.some((a) => a.regularisations.length > 0)) {
      throw new ConflictException(
        `L'avance de la mission n° ${m.numero} est régularisée · ses frais sont figés. Annulez la régularisation pour les changer ; pour annuler la mission, annulez la régularisation, puis l'avance, puis la mission.`,
      );
    }
    if (porteurActif(m)) {
      throw new ConflictException(
        `La mission n° ${m.numero} est portée par le bulletin émis n° ${m.bulletin!.numero} · annulez-le d'abord, la mission redeviendra modifiable.`,
      );
    }
    return m;
  }

  /**
   * M1 DE LA RELECTURE · ajouter, retirer un frais ou annuler la mission se
   * fait DANS une transaction, sous le verrou de la mission, le porteur actif
   * RELU dedans · sans quoi un frais s'ajoutait à une mission qu'un bulletin
   * venait de figer.
   */
  async ajouterFrais(tenantId: string, email: string, missionId: string, dto: FraisMissionDto) {
    const refus = motifRefusFrais(dto);
    if (refus) throw new BadRequestException(refus);
    const id = await transactionJournalisee(this.prisma, async (tx) => {
      await verrouillerMission(tx, tenantId, missionId);
      const m = await this.modifiable(tx, tenantId, missionId);
      if (m._count.frais >= PLAFOND_FRAIS_PAR_MISSION) {
        throw new BadRequestException(`Une mission porte au plus ${PLAFOND_FRAIS_PAR_MISSION} frais (convention d'OmegaX).`);
      }
      await tx.fraisMission.create({
        data: {
          tenantId,
          missionId: m.id,
          element: dto.element,
          qualification: dto.qualification,
          montantFc: dto.montantFc,
          piece: dto.piece?.trim() || null,
          libelle: dto.libelle?.trim() || null,
          creePar: email,
        },
      });
      return m.id;
    });
    return this.lire(tenantId, id);
  }

  async retirerFrais(tenantId: string, fraisId: string) {
    const f = await this.prisma.fraisMission.findFirst({ where: { id: fraisId, tenantId }, select: { id: true, missionId: true } });
    if (!f) throw new NotFoundException('Frais introuvable dans ce dossier.');
    await transactionJournalisee(this.prisma, async (tx) => {
      await verrouillerMission(tx, tenantId, f.missionId);
      await this.modifiable(tx, tenantId, f.missionId);
      const r = await tx.fraisMission.deleteMany({ where: { id: f.id, tenantId, missionId: f.missionId } });
      if (r.count !== 1) throw new ConflictException('Ce frais a été retiré entre-temps · relisez la mission.');
    });
    return this.lire(tenantId, f.missionId);
  }

  /** La fin de mission constatée · une fois, jamais avant le départ. */
  async constaterFin(tenantId: string, id: string, dto: FinMissionDto) {
    const m = await this.prisma.missionSalarie.findFirst({ where: { id, tenantId }, select: { id: true, numero: true, dateDepart: true, accomplieLe: true, annuleLe: true } });
    if (!m) throw new NotFoundException('Mission introuvable dans ce dossier.');
    if (m.annuleLe) throw new ConflictException(`La mission n° ${m.numero} est annulée.`);
    if (m.accomplieLe) throw new ConflictException(`La fin de la mission n° ${m.numero} est déjà constatée au ${iso(m.accomplieLe)}.`);
    const date = jourUtc(dto.accomplieLe);
    if (date < m.dateDepart) throw new BadRequestException('La fin de mission ne peut précéder le départ.');
    await this.prisma.missionSalarie.update({ where: { id: m.id }, data: { accomplieLe: date } });
    return this.lire(tenantId, m.id);
  }

  /** Une mission ne se supprime pas · elle s'annule avec son motif, au journal d'audit. */
  async annuler(tenantId: string, id: string, dto: AnnulationMissionDto) {
    await transactionJournalisee(this.prisma, async (tx) => {
      await verrouillerMission(tx, tenantId, id);
      const m = await this.modifiable(tx, tenantId, id);
      // Ligne paie-declarations · une avance versée reste au 4213 · la mission
      // annulée la laisserait sans régularisation possible.
      if (m.avances.length > 0) {
        throw new ConflictException(`La mission n° ${m.numero} porte une avance non annulée · annulez l'avance avant d'annuler la mission.`);
      }
      await tx.missionSalarie.update({ where: { id: m.id }, data: { annuleLe: new Date(), motifAnnulation: dto.motif.trim() } });
    });
    return this.lire(tenantId, id);
  }
}
