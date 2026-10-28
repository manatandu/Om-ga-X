import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { jourDeKinshasa } from '../../common/echeance';
import { CongesService } from './conges.service';
import { estNationaliteCongolaise } from './effectif-registre';
import {
  AccordDemandeCongeDto,
  AnnulationFormationDto,
  DemandeCongeDto,
  FormationDto,
  ParticipantsFormationDto,
  RealisationFormationDto,
  RefusDemandeCongeDto,
} from './dto/suivi-personnel.dto';
import {
  FONDEMENT_TITRE_CONGE,
  HORIZON_ECHEANCIER_JOURS,
  RESERVE_DECLARATION_MAIN_OEUVRE,
  echeancesDuContrat,
  libelleStatut,
  motifRefusDecision,
  motifRefusDemandeConge,
  motifRefusFormation,
  motifRefusRealisation,
  suiviFormation,
  type StatutDemandeConge,
  type StatutFormation,
} from './suivi-personnel';

/** Listes de travail bornées (§ 8 bis) · elles disent quand elles ne couvrent pas tout. */
export const PLAFOND_SUIVI = 500;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const jourUtc = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
const nomDe = (s: { nom: string; postNom: string | null; prenoms: string | null }) =>
  [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const nombre = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

/**
 * LIGNE MICROFINA-M3, LOT 2 · demandes de congé, échéancier des contrats,
 * formation et déclaration annuelle de la main-d'œuvre. Règles et textes dans
 * `suivi-personnel.ts`.
 */
/** Une formation inscrit au plus deux cents participants · convention d'OmegaX, la liste lue n'en coupe aucun. */
export const PARTICIPANTS_PAR_FORMATION = 200;

@Injectable()
export class SuiviPersonnelService {
  private readonly journal = new Logger('SuiviPersonnelService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly conges: CongesService,
  ) {}

  // ---- Idée 7 · demandes de congé -------------------------------------

  async listerDemandes(tenantId: string, salarieId?: string) {
    const [demandes, total] = await Promise.all([
      this.prisma.demandeCongeSalarie.findMany({
        where: { tenantId, ...(salarieId ? { salarieId } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PLAFOND_SUIVI,
        include: { salarie: { select: { nom: true, postNom: true, prenoms: true, matricule: true } } },
      }),
      this.prisma.demandeCongeSalarie.count({ where: { tenantId, ...(salarieId ? { salarieId } : {}) } }),
    ]);
    return {
      demandes: demandes.map((d) => ({
        id: d.id,
        salarieId: d.salarieId,
        salarie: nomDe(d.salarie),
        matricule: d.salarie.matricule,
        du: iso(d.du),
        au: iso(d.au),
        joursVoyage: d.joursVoyage,
        moisDePaie: d.moisDePaie,
        demandeLe: iso(d.demandeLe),
        observation: d.observation,
        statut: d.statut,
        libelleStatut: libelleStatut(d.statut as StatutDemandeConge),
        saisiePar: d.saisiePar,
        decisionPar: d.decisionPar,
        decisionLe: d.decisionLe,
        motifDecision: d.motifDecision,
        congeId: d.congeId,
      })),
      total,
      plafond: PLAFOND_SUIVI,
      tronque: total > demandes.length,
    };
  }

  async creerDemande(tenantId: string, email: string, salarieId: string, dto: DemandeCongeDto) {
    const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const refus = motifRefusDemandeConge(dto);
    if (refus) throw new BadRequestException(refus);
    return this.prisma.demandeCongeSalarie.create({
      data: {
        tenantId,
        salarieId,
        du: jourUtc(dto.du),
        au: jourUtc(dto.au),
        joursVoyage: dto.joursVoyage ?? 0,
        moisDePaie: dto.moisDePaie,
        demandeLe: jourUtc(dto.demandeLe),
        observation: dto.observation?.trim() || null,
        saisiePar: email,
      },
    });
  }

  private async decidable(tenantId: string, id: string, decideur: string) {
    const d = await this.prisma.demandeCongeSalarie.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Demande introuvable dans ce dossier.');
    const refus = motifRefusDecision({ statut: d.statut as StatutDemandeConge, saisiePar: d.saisiePar }, decideur);
    if (refus) throw refus.statut === 403 ? new ForbiddenException(refus.motif) : new ConflictException(refus.motif);
    return d;
  }

  /**
   * L'ACCORD · la demande est prise (une seule décision, `updateMany` filtré
   * sur le statut), puis le congé naît par la route ordinaire, avec tous ses
   * refus. Refusé, la prise est rendue · la demande reste en attente, avec le
   * motif du refus à l'utilisateur ; jamais un accord sans congé.
   */
  async accorder(tenantId: string, email: string, id: string, dto: AccordDemandeCongeDto) {
    const d = await this.decidable(tenantId, id, email);
    const prise = await this.prisma.demandeCongeSalarie.updateMany({
      where: { id: d.id, tenantId, statut: 'DEMANDEE' },
      data: { statut: 'ACCORDEE', decisionPar: email, decisionLe: new Date() },
    });
    if (prise.count !== 1) throw new ConflictException('La demande a été décidée entre-temps · relisez-la.');
    let conge: Awaited<ReturnType<CongesService['creerConge']>>;
    try {
      conge = await this.conges.creerConge(tenantId, email, d.salarieId, {
        ...dto,
        du: iso(d.du),
        au: iso(d.au),
        joursVoyage: d.joursVoyage,
        moisDePaie: d.moisDePaie,
      });
    } catch (e) {
      // La prise se rend · un échec du retour est CONSIGNÉ, et l'erreur
      // d'origine remonte quand même (la demande se dirait accordée sans
      // congé · le titre la refuse, faute de congé lié).
      try {
        await this.prisma.demandeCongeSalarie.update({ where: { id: d.id }, data: { statut: 'DEMANDEE', decisionPar: null, decisionLe: null } });
      } catch (retour) {
        this.journal.error(`Demande de congé ${d.id} · la prise n'a pas pu être rendue après le refus du congé`, retour instanceof Error ? retour.stack : String(retour));
      }
      throw e;
    }
    await this.prisma.demandeCongeSalarie.update({ where: { id: d.id }, data: { congeId: conge.id } });
    return { demandeId: d.id, congeId: conge.id, jours: conge.jours, avertissements: conge.avertissements };
  }

  async refuser(tenantId: string, email: string, id: string, dto: RefusDemandeCongeDto) {
    const d = await this.decidable(tenantId, id, email);
    const r = await this.prisma.demandeCongeSalarie.updateMany({
      where: { id: d.id, tenantId, statut: 'DEMANDEE' },
      data: { statut: 'REFUSEE', decisionPar: email, decisionLe: new Date(), motifDecision: dto.motif.trim() },
    });
    if (r.count !== 1) throw new ConflictException('La demande a été décidée entre-temps · relisez-la.');
    return { refusee: true };
  }

  /** Le retrait · par qui que ce soit, tant qu'elle attend, avec son motif. */
  async retirer(tenantId: string, email: string, id: string, dto: RefusDemandeCongeDto) {
    const r = await this.prisma.demandeCongeSalarie.updateMany({
      where: { id, tenantId, statut: 'DEMANDEE' },
      data: { statut: 'RETIREE', decisionPar: email, decisionLe: new Date(), motifDecision: dto.motif.trim() },
    });
    if (r.count !== 1) throw new ConflictException('Seule une demande en attente se retire.');
    return { retiree: true };
  }

  /**
   * LE TITRE DE CONGÉ · une demande ACCORDÉE dont le congé n'est pas annulé.
   * Les jours sont ceux que le compteur a comptés au congé · rien n'est
   * recalculé ici.
   */
  async titre(tenantId: string, id: string) {
    const d = await this.prisma.demandeCongeSalarie.findFirst({
      where: { id, tenantId },
      include: {
        salarie: { select: { nom: true, postNom: true, prenoms: true, matricule: true, contrats: { select: { natureTravail: true, dateEntreeEnVigueur: true }, orderBy: { dateEntreeEnVigueur: 'desc' }, take: 1 } } },
        conge: { select: { annuleLe: true } },
      },
    });
    if (!d) throw new NotFoundException('Demande introuvable dans ce dossier.');
    if (d.statut !== 'ACCORDEE' || !d.congeId) throw new BadRequestException('Seule une demande accordée a un titre de congé.');
    if (d.conge?.annuleLe) throw new BadRequestException('Le congé de cette demande est annulé · son titre ne se délivre plus.');
    const compteur = await this.conges.compteur(tenantId, d.salarieId);
    const ligne = compteur.conges.find((c) => c.id === d.congeId);
    return {
      salarie: nomDe(d.salarie),
      matricule: d.salarie.matricule,
      emploi: d.salarie.contrats[0]?.natureTravail ?? null,
      du: iso(d.du),
      au: iso(d.au),
      joursVoyage: d.joursVoyage,
      // Lu au compteur · introuvable (liste tronquée) ou non chiffré, null, jamais zéro.
      jours: ligne?.allocation.jours ?? null,
      demandeLe: iso(d.demandeLe),
      accordeLe: d.decisionLe ? iso(d.decisionLe) : null,
      accordePar: d.decisionPar,
      fondement: FONDEMENT_TITRE_CONGE,
    };
  }

  // ---- Idée 10 · échéancier des contrats ------------------------------

  async echeancier(tenantId: string, horizon?: number) {
    const aujourdhui = jourDeKinshasa(new Date());
    const h = horizon ?? HORIZON_ECHEANCIER_JOURS;
    const where: Prisma.ContratTravailWhereInput = {
      tenantId,
      dateFin: null,
      OR: [{ type: 'DUREE_DETERMINEE', dateFinPrevue: { not: null } }, { clauseEssai: true }],
    };
    const [contrats, total] = await Promise.all([
      this.prisma.contratTravail.findMany({
        where: { ...where, tenantId },
        orderBy: [{ dateEntreeEnVigueur: 'asc' }, { id: 'asc' }],
        take: PLAFOND_SUIVI,
        select: {
          id: true,
          salarieId: true,
          type: true,
          dateEntreeEnVigueur: true,
          dateFin: true,
          dateFinPrevue: true,
          emploiPermanent: true,
          clauseEssai: true,
          essaiDureeJours: true,
          manoeuvreSansSpecialite: true,
          salarie: { select: { nom: true, postNom: true, prenoms: true, matricule: true } },
        },
      }),
      this.prisma.contratTravail.count({ where: { ...where, tenantId } }),
    ]);
    const echeances = contrats
      .flatMap((c) => echeancesDuContrat(c, aujourdhui, h).map((e) => ({ ...e, salarie: nomDe(c.salarie), matricule: c.salarie.matricule })))
      .sort((a, b) => a.echeance.localeCompare(b.echeance));
    return { aujourdhui: iso(aujourdhui), horizonJours: h, echeances, contratsLus: contrats.length, total, tronque: total > contrats.length };
  }

  // ---- Idée 8 · formation ---------------------------------------------

  private async salariesDuDossier(tenantId: string, ids: readonly string[]) {
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Un salarié figure deux fois parmi les participants.');
    if (!ids.length) return;
    const n = await this.prisma.salarie.count({ where: { tenantId, id: { in: [...ids] } } });
    if (n !== ids.length) throw new BadRequestException('Un participant est introuvable dans ce dossier.');
  }

  async listerFormations(tenantId: string, annee?: number) {
    const borne = annee ? { prevueDu: { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) } } : {};
    const [formations, total] = await Promise.all([
      this.prisma.formationPersonnel.findMany({
        where: { tenantId, ...borne },
        orderBy: [{ prevueDu: 'desc' }, { id: 'desc' }],
        take: PLAFOND_SUIVI,
        include: {
          participants: { take: PARTICIPANTS_PAR_FORMATION, select: { salarieId: true, present: true, salarie: { select: { nom: true, postNom: true, prenoms: true } } } },
        },
      }),
      this.prisma.formationPersonnel.count({ where: { tenantId, ...borne } }),
    ]);
    const lignes = formations.map((f) => ({
      id: f.id,
      intitule: f.intitule,
      organisme: f.organisme,
      interne: f.interne,
      lieu: f.lieu,
      financement: f.financement,
      prevueDu: iso(f.prevueDu),
      prevueAu: iso(f.prevueAu),
      coutPrevuFc: nombre(f.coutPrevuFc),
      statut: f.statut,
      realiseeDu: f.realiseeDu ? iso(f.realiseeDu) : null,
      realiseeAu: f.realiseeAu ? iso(f.realiseeAu) : null,
      coutReelFc: nombre(f.coutReelFc),
      motifAnnulation: f.motifAnnulation,
      participants: f.participants.map((p) => ({ salarieId: p.salarieId, nom: nomDe(p.salarie), present: p.present })),
    }));
    return {
      formations: lignes,
      // Le suivi se lit sur la tranche rendue · tronquée, il le dit.
      suivi: suiviFormation(
        lignes.map((f) => ({
          statut: f.statut as StatutFormation,
          coutPrevuFc: f.coutPrevuFc,
          coutReelFc: f.coutReelFc,
          inscrits: f.participants.length,
          presents: f.participants.filter((p) => p.present === true).length,
        })),
      ),
      total,
      plafond: PLAFOND_SUIVI,
      tronque: total > lignes.length,
    };
  }

  async creerFormation(tenantId: string, email: string, dto: FormationDto) {
    const refus = motifRefusFormation(dto);
    if (refus) throw new BadRequestException(refus);
    const participants = dto.participants ?? [];
    await this.salariesDuDossier(tenantId, participants);
    return this.prisma.formationPersonnel.create({
      data: {
        tenantId,
        intitule: dto.intitule.trim(),
        organisme: dto.organisme?.trim() || null,
        interne: dto.interne === true,
        lieu: dto.lieu?.trim() || null,
        financement: dto.financement?.trim() || null,
        prevueDu: jourUtc(dto.prevueDu),
        prevueAu: jourUtc(dto.prevueAu),
        coutPrevuFc: dto.coutPrevuFc ?? null,
        creePar: email,
        participants: { create: participants.map((salarieId) => ({ tenantId, salarieId })) },
      },
      select: { id: true },
    });
  }

  private async formationPrevue(tenantId: string, id: string) {
    const f = await this.prisma.formationPersonnel.findFirst({ where: { id, tenantId }, select: { id: true, statut: true } });
    if (!f) throw new NotFoundException('Formation introuvable dans ce dossier.');
    if (f.statut !== 'PREVUE') throw new ConflictException(`Cette formation est ${f.statut === 'REALISEE' ? 'réalisée' : 'annulée'} · ses inscrits ne changent plus.`);
    return f;
  }

  async inscrire(tenantId: string, id: string, dto: ParticipantsFormationDto) {
    const f = await this.formationPrevue(tenantId, id);
    await this.salariesDuDossier(tenantId, dto.salarieIds);
    const deja = await this.prisma.participantFormation.findMany({ where: { tenantId, formationId: f.id }, select: { salarieId: true }, take: PARTICIPANTS_PAR_FORMATION });
    const nouveaux = dto.salarieIds.filter((s) => !deja.some((d) => d.salarieId === s));
    if (deja.length + nouveaux.length > PARTICIPANTS_PAR_FORMATION) {
      throw new BadRequestException(`Une formation inscrit au plus ${PARTICIPANTS_PAR_FORMATION} participants (convention d'OmegaX) · prévoyez une seconde session.`);
    }
    for (const salarieId of nouveaux) await this.prisma.participantFormation.create({ data: { tenantId, formationId: f.id, salarieId } });
    return { inscrits: deja.length + nouveaux.length };
  }

  async desinscrire(tenantId: string, id: string, salarieId: string) {
    const f = await this.formationPrevue(tenantId, id);
    const p = await this.prisma.participantFormation.findFirst({ where: { tenantId, formationId: f.id, salarieId }, select: { id: true } });
    if (!p) throw new NotFoundException("Ce salarié n'est pas inscrit à la formation.");
    await this.prisma.participantFormation.delete({ where: { id: p.id } });
    return { retire: true };
  }

  /** La réalisation · dates et coût réels, présents nommés · un inscrit non nommé est absent, jamais présumé présent. */
  async realiser(tenantId: string, id: string, dto: RealisationFormationDto) {
    const f = await this.prisma.formationPersonnel.findFirst({
      where: { id, tenantId },
      select: { id: true, statut: true, participants: { select: { id: true, salarieId: true }, take: PARTICIPANTS_PAR_FORMATION } },
    });
    if (!f) throw new NotFoundException('Formation introuvable dans ce dossier.');
    const inconnus = dto.presents.filter((s) => !f.participants.some((p) => p.salarieId === s));
    if (inconnus.length) throw new BadRequestException("Un présent n'est pas inscrit à la formation · inscrivez-le d'abord.");
    const refus = motifRefusRealisation({ statut: f.statut as StatutFormation }, { ...dto, presents: dto.presents.length });
    if (refus) throw new BadRequestException(refus);
    const r = await this.prisma.formationPersonnel.updateMany({
      where: { id: f.id, tenantId, statut: 'PREVUE' },
      data: { statut: 'REALISEE', realiseeDu: jourUtc(dto.realiseeDu), realiseeAu: jourUtc(dto.realiseeAu), coutReelFc: dto.coutReelFc ?? null },
    });
    if (r.count !== 1) throw new ConflictException('La formation a changé entre-temps · relisez-la.');
    for (const p of f.participants) {
      await this.prisma.participantFormation.update({ where: { id: p.id }, data: { present: dto.presents.includes(p.salarieId) } });
    }
    return { realisee: true };
  }

  async annulerFormation(tenantId: string, id: string, dto: AnnulationFormationDto) {
    const r = await this.prisma.formationPersonnel.updateMany({
      where: { id, tenantId, statut: 'PREVUE' },
      data: { statut: 'ANNULEE', motifAnnulation: dto.motif.trim() },
    });
    if (r.count !== 1) throw new ConflictException('Seule une formation prévue s’annule.');
    return { annulee: true };
  }

  // ---- Idée 11 · déclaration annuelle de la main-d'œuvre --------------

  /**
   * LES CHIFFRES DE L'ART. 218 · l'effectif au 31 décembre de l'année, par
   * nationalité (nationale, étrangère) et par sexe, et les entrées et
   * sorties de l'année. Des AGRÉGATS de la base, un salarié compté une fois
   * (`some`). Une nationalité absente rend la répartition non calculée.
   */
  async declarationMainOeuvre(tenantId: string, annee: number) {
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) throw new BadRequestException("L'année se lit sur quatre chiffres.");
    const debut = new Date(Date.UTC(annee, 0, 1));
    const fin = new Date(Date.UTC(annee, 11, 31));
    const enVigueurAu = (d: Date) => ({ tenantId, dateEntreeEnVigueur: { lte: d }, OR: [{ dateFin: null }, { dateFin: { gte: d } }] });
    const [groupes, entrees, sorties] = await Promise.all([
      this.prisma.salarie.groupBy({
        by: ['sexe', 'nationalite'],
        where: { tenantId, contrats: { some: enVigueurAu(fin) } },
        _count: { _all: true },
      }),
      this.prisma.salarie.count({ where: { tenantId, contrats: { some: { tenantId, dateEntreeEnVigueur: { gte: debut, lte: fin } } } } }),
      this.prisma.salarie.count({ where: { tenantId, contrats: { some: { tenantId, dateFin: { gte: debut, lte: fin } } } } }),
    ]);
    const somme = (garder: (g: (typeof groupes)[number]) => boolean) => groupes.filter(garder).reduce((t, g) => t + g._count._all, 0);
    const sansNationalite = somme((g) => !(g.nationalite ?? '').trim());
    const avec = (g: (typeof groupes)[number]) => !!(g.nationalite ?? '').trim();
    const ventile = (sexe: 'MASCULIN' | 'FEMININ') => ({
      nationaux: sansNationalite > 0 ? null : somme((g) => avec(g) && g.sexe === sexe && estNationaliteCongolaise(g.nationalite)),
      etrangers: sansNationalite > 0 ? null : somme((g) => avec(g) && g.sexe === sexe && !estNationaliteCongolaise(g.nationalite)),
    });
    return {
      annee,
      au: iso(fin),
      effectif: somme(() => true),
      hommes: ventile('MASCULIN'),
      femmes: ventile('FEMININ'),
      sexeNonRenseigne: somme((g) => g.sexe !== 'MASCULIN' && g.sexe !== 'FEMININ'),
      sansNationalite,
      // Salariés dont un contrat est entré en vigueur, ou a pris fin, dans l'année.
      entrees,
      sorties,
      destinataires:
        "au service compétent du ministère ayant l'emploi, le travail et la prévoyance sociale dans ses attributions et à l'Office national de l'emploi (art. 218)",
      reserve: RESERVE_DECLARATION_MAIN_OEUVRE,
      reserveNationalite:
        sansNationalite > 0
          ? `${sansNationalite} salarié(s) de l'effectif n'ont pas de nationalité au registre · la répartition nationale et étrangère n'est pas calculée.`
          : null,
    };
  }
}
