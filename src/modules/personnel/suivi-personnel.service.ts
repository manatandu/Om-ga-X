import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasa } from '../../common/echeance';
import { CongesService } from './conges.service';
import { estNationaliteCongolaise } from './effectif-registre';
import {
  DEROGATION_JOUR_LE_JOUR,
  EXEMPLAIRES_ETABLISSEMENT,
  EXEMPLAIRES_MOUVEMENT,
  FORMULAIRE_2023_NON_LU,
  FONDEMENT_ETABLISSEMENT,
  FONDEMENT_MOUVEMENT,
  NATURES_ETABLISSEMENT,
  PRIMAUTE_DELAI_LOI,
  fenetreDeclarationEtablissement,
  formulaireEtablissement,
  formulaireMouvement,
  motifRefusMouvement,
  type MotifMouvement,
} from './declarations-travail';
import { declarationsDues } from './regles-contrat-travail';
import {
  AccordDemandeCongeDto,
  AnnulationFormationDto,
  DemandeCongeDto,
  FormationDto,
  ParticipantsFormationDto,
  RealisationFormationDto,
  RefusDemandeCongeDto,
  ReparationDemandeCongeDto,
} from './dto/suivi-personnel.dto';
import {
  FONDEMENT_TITRE_CONGE,
  HORIZON_ECHEANCIER_JOURS,
  DESTINATAIRES_DECLARATION_MAIN_OEUVRE,
  dateLimiteDeclarationMainOeuvre,
  REGLE_MOUVEMENTS_MAIN_OEUVRE,
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

  /**
   * Une demande qui CHEVAUCHE une demande encore en attente du même salarié
   * est refusée, et le double envoi avec elle · lecture et création se font
   * dans une transaction, sous un verrou par salarié, sans quoi deux clics
   * rapprochés faisaient deux demandes, et l'accord de l'une laissait l'autre
   * en attente sur des jours déjà pris.
   */
  async creerDemande(tenantId: string, email: string, salarieId: string, dto: DemandeCongeDto) {
    const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const refus = motifRefusDemandeConge(dto);
    if (refus) throw new BadRequestException(refus);
    const du = jourUtc(dto.du);
    const au = jourUtc(dto.au);
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "salaries" WHERE id = ${salarieId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const enAttente = await tx.demandeCongeSalarie.findFirst({
        where: { tenantId, salarieId, statut: 'DEMANDEE', du: { lte: au }, au: { gte: du } },
        select: { du: true, au: true, demandeLe: true },
      });
      if (enAttente) {
        throw new ConflictException(
          `Une demande du même salarié, du ${iso(enAttente.du)} au ${iso(enAttente.au)}, attend déjà sa décision sur ces jours · décidez-la ou retirez-la d'abord.`,
        );
      }
      return tx.demandeCongeSalarie.create({
        data: {
          tenantId,
          salarieId,
          du,
          au,
          joursVoyage: dto.joursVoyage ?? 0,
          moisDePaie: dto.moisDePaie,
          demandeLe: jourUtc(dto.demandeLe),
          observation: dto.observation?.trim() || null,
          saisiePar: email,
        },
      });
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
   * L'ACCORD · M2 DE LA RELECTURE. Il se faisait en trois écritures hors
   * transaction (prise de la demande, congé, lien) · le lien manqué laissait
   * une demande ACCORDÉE sans congé, que le titre refusait et qu'aucune
   * décision ne pouvait plus toucher. Le congé naît D'ABORD, par la route
   * ordinaire et tous ses refus ; puis la demande est prise en UNE écriture
   * conditionnelle (en attente vers accordée, avec le lien du congé). Si elle
   * a été décidée entre-temps, le congé qui vient de naître est annulé avec
   * son motif · jamais deux congés pour une demande, jamais un accord sans
   * congé. Un retour manqué est consigné avec les deux identifiants.
   */
  async accorder(tenantId: string, email: string, id: string, dto: AccordDemandeCongeDto) {
    const d = await this.decidable(tenantId, id, email);
    const conge = await this.conges.creerConge(tenantId, email, d.salarieId, {
      ...dto,
      du: iso(d.du),
      au: iso(d.au),
      joursVoyage: d.joursVoyage,
      moisDePaie: d.moisDePaie,
    });
    const prise = await this.prisma.demandeCongeSalarie.updateMany({
      where: { id: d.id, tenantId, statut: 'DEMANDEE', congeId: null },
      data: { statut: 'ACCORDEE', decisionPar: email, decisionLe: new Date(), congeId: conge.id },
    });
    if (prise.count !== 1) {
      try {
        await this.conges.annulerConge(tenantId, email, conge.id, "Accord d'une demande de congé décidée entre-temps · le congé posé par cet accord est retiré.");
      } catch (retour) {
        this.journal.error(
          `Demande de congé ${d.id} décidée entre-temps · le congé ${conge.id} posé par l'accord n'a pas pu être annulé`,
          retour instanceof Error ? retour.stack : String(retour),
        );
      }
      throw new ConflictException('La demande a été décidée entre-temps · relisez-la. Le congé posé par cet accord a été annulé.');
    }
    return { demandeId: d.id, congeId: conge.id, jours: conge.jours, avertissements: conge.avertissements };
  }

  /**
   * L'ISSUE D'UNE DEMANDE ACCORDÉE SANS CONGÉ LIÉ, héritée de l'accord en
   * trois écritures · la RELIER au congé qui a bien été posé (même salarié,
   * mêmes dates, non annulé, lié à aucune autre demande), ou la REMETTRE EN
   * ATTENTE, pour la décider à nouveau. Motif exigé, au journal d'audit, par
   * une mise à jour unitaire sous le verrou de la demande.
   */
  async reparerDemandeSansConge(tenantId: string, email: string, id: string, dto: ReparationDemandeCongeDto) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "demandes_conge_salarie" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const d = await tx.demandeCongeSalarie.findFirst({ where: { id, tenantId } });
      if (!d) throw new NotFoundException('Demande introuvable dans ce dossier.');
      if (d.statut !== 'ACCORDEE' || d.congeId) throw new ConflictException('Seule une demande accordée sans congé lié se répare ainsi.');
      const motif = `${dto.motif.trim()} (réparation par ${email})`.slice(0, 500);
      if (dto.action === 'REMETTRE_EN_ATTENTE') {
        await tx.demandeCongeSalarie.update({ where: { id: d.id }, data: { statut: 'DEMANDEE', decisionPar: null, decisionLe: null, motifDecision: motif } });
        return { demandeId: d.id, statut: 'DEMANDEE' as const };
      }
      if (!dto.congeId) throw new BadRequestException('Relier la demande exige le congé posé pour elle.');
      const c = await tx.congeSalarie.findFirst({ where: { id: dto.congeId, tenantId }, select: { id: true, salarieId: true, du: true, au: true, annuleLe: true } });
      if (!c) throw new NotFoundException('Congé introuvable dans ce dossier.');
      if (c.salarieId !== d.salarieId) throw new BadRequestException("Ce congé est celui d'un autre salarié.");
      if (c.annuleLe) throw new BadRequestException('Ce congé est annulé · remettez plutôt la demande en attente.');
      if (c.du.getTime() !== d.du.getTime() || c.au.getTime() !== d.au.getTime()) {
        throw new BadRequestException(`Le congé va du ${iso(c.du)} au ${iso(c.au)}, la demande du ${iso(d.du)} au ${iso(d.au)} · ils ne se relient pas.`);
      }
      const autre = await tx.demandeCongeSalarie.findFirst({ where: { tenantId, congeId: c.id }, select: { id: true } });
      if (autre) throw new ConflictException('Ce congé est déjà lié à une autre demande.');
      await tx.demandeCongeSalarie.update({ where: { id: d.id }, data: { congeId: c.id, motifDecision: motif } });
      return { demandeId: d.id, statut: 'ACCORDEE' as const, congeId: c.id };
    });
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
    // L'HORIZON SE FILTRE EN BASE, AVANT LA BORNE · filtrée après, la tranche
    // des 500 premiers contrats (les plus anciens) taisait l'échéance proche
    // d'un contrat récent. Terme de CDD au plus tard à l'horizon (un terme
    // passé reste nommé tant que le contrat court) ; essai d'un contrat entré
    // en vigueur dans la fenêtre où sa fin peut tomber (au plus six mois de
    // date à date, art. 43, d'où 186 jours de marge), le reste trié par le
    // moteur (`echeancesDuContrat`).
    const jour = 24 * 3600 * 1000;
    const limite = new Date(aujourdhui.getTime() + h * jour);
    const plusAncienEssai = new Date(aujourdhui.getTime() - (h + 186) * jour);
    const where: Prisma.ContratTravailWhereInput = {
      tenantId,
      dateFin: null,
      OR: [
        { type: 'DUREE_DETERMINEE', dateFinPrevue: { not: null, lte: limite } },
        { clauseEssai: true, dateEntreeEnVigueur: { gte: plusAncienEssai, lte: limite } },
      ],
    };
    const [contrats, total] = await Promise.all([
      this.prisma.contratTravail.findMany({
        where: { ...where, tenantId },
        orderBy: [{ dateFinPrevue: { sort: 'asc', nulls: 'last' } }, { dateEntreeEnVigueur: 'asc' }, { id: 'asc' }],
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

  private async formationPrevue(db: PrismaService | Prisma.TransactionClient, tenantId: string, id: string) {
    const f = await db.formationPersonnel.findFirst({ where: { id, tenantId }, select: { id: true, statut: true } });
    if (!f) throw new NotFoundException('Formation introuvable dans ce dossier.');
    if (f.statut !== 'PREVUE') throw new ConflictException(`Cette formation est ${f.statut === 'REALISEE' ? 'réalisée' : 'annulée'} · ses inscrits ne changent plus.`);
    return f;
  }

  /** Le plafond des inscrits se juge SOUS LE VERROU de la formation · deux inscriptions simultanées le dépassaient. */
  async inscrire(tenantId: string, id: string, dto: ParticipantsFormationDto) {
    await this.salariesDuDossier(tenantId, dto.salarieIds);
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "formations_personnel" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const f = await this.formationPrevue(tx, tenantId, id);
      const deja = await tx.participantFormation.findMany({ where: { tenantId, formationId: f.id }, select: { salarieId: true }, take: PARTICIPANTS_PAR_FORMATION + 1 });
      const nouveaux = dto.salarieIds.filter((s) => !deja.some((d) => d.salarieId === s));
      if (deja.length + nouveaux.length > PARTICIPANTS_PAR_FORMATION) {
        throw new BadRequestException(`Une formation inscrit au plus ${PARTICIPANTS_PAR_FORMATION} participants (convention d'OmegaX) · prévoyez une seconde session.`);
      }
      for (const salarieId of nouveaux) await tx.participantFormation.create({ data: { tenantId, formationId: f.id, salarieId } });
      return { inscrits: deja.length + nouveaux.length };
    });
  }

  async desinscrire(tenantId: string, id: string, salarieId: string) {
    const f = await this.formationPrevue(this.prisma, tenantId, id);
    const p = await this.prisma.participantFormation.findFirst({ where: { tenantId, formationId: f.id, salarieId }, select: { id: true } });
    if (!p) throw new NotFoundException("Ce salarié n'est pas inscrit à la formation.");
    await this.prisma.participantFormation.delete({ where: { id: p.id } });
    return { retire: true };
  }

  /** La réalisation · dates et coût réels, présents nommés · un inscrit non nommé est absent, jamais présumé présent. */
  async realiser(tenantId: string, id: string, dto: RealisationFormationDto) {
    // UNE SEULE TRANSACTION, sous le verrou de la formation · réalisée puis
    // interrompue en route, elle gardait des présences à moitié écrites, et
    // un inscrit ajouté entre la lecture et l'écriture restait sans présence.
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "formations_personnel" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const f = await tx.formationPersonnel.findFirst({
        where: { id, tenantId },
        select: { id: true, statut: true, participants: { select: { id: true, salarieId: true }, take: PARTICIPANTS_PAR_FORMATION } },
      });
      if (!f) throw new NotFoundException('Formation introuvable dans ce dossier.');
      const inconnus = dto.presents.filter((s) => !f.participants.some((p) => p.salarieId === s));
      if (inconnus.length) throw new BadRequestException("Un présent n'est pas inscrit à la formation · inscrivez-le d'abord.");
      const refus = motifRefusRealisation({ statut: f.statut as StatutFormation }, { ...dto, presents: dto.presents.length });
      if (refus) throw new BadRequestException(refus);
      await tx.formationPersonnel.update({
        where: { id: f.id },
        data: { statut: 'REALISEE', realiseeDu: jourUtc(dto.realiseeDu), realiseeAu: jourUtc(dto.realiseeAu), coutReelFc: dto.coutReelFc ?? null },
      });
      for (const p of f.participants) {
        await tx.participantFormation.update({ where: { id: p.id }, data: { present: dto.presents.includes(p.salarieId) } });
      }
      return { realisee: true };
    });
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
   * LES CHIFFRES DE L'ART. 218 · l'effectif au 1er janvier de l'année qui
   * suit (le formulaire de l'arrêté n° 005/CAB/PVPM/ETPS/2010 compte le
   * « personnel permanent au premier janvier de l'année en cours »), par
   * nationalité (nationale, étrangère) et par sexe, et les entrées et
   * sorties de l'année. Des AGRÉGATS de la base, un salarié compté une fois
   * (`some`). Une nationalité absente rend la répartition non calculée.
   */
  async declarationMainOeuvre(tenantId: string, annee: number) {
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) throw new BadRequestException("L'année se lit sur quatre chiffres.");
    const debut = new Date(Date.UTC(annee, 0, 1));
    const fin = new Date(Date.UTC(annee, 11, 31));
    const premierJanvierSuivant = new Date(Date.UTC(annee + 1, 0, 1));
    const enVigueurAu = (d: Date) => ({ tenantId, dateEntreeEnVigueur: { lte: d }, OR: [{ dateFin: null }, { dateFin: { gte: d } }] });
    // M3 DE LA RELECTURE · ENTRÉES ET SORTIES SE LISENT COMME L'ART. 217 LES
    // DÉCLARE · « à l'occasion de son ENGAGEMENT » et « tout travailleur
    // QUITTANT L'EMPLOYEUR […] la date du départ de l'entreprise ». Un CDD
    // renouvelé, ou suivi d'un CDI sans interruption, n'est ni un engagement
    // ni un départ · il comptait jusque-là une entrée ET une sortie. Une
    // ENTRÉE est donc un contrat pris d'effet dans l'année sans qu'aucun autre
    // contrat du salarié soit en vigueur la VEILLE ; une SORTIE, un contrat
    // fini dans l'année sans qu'aucun autre soit en vigueur le LENDEMAIN. Deux
    // contrats nés (ou finis) le même jour comptent une fois. On compte des
    // MOUVEMENTS · un salarié parti puis réengagé dans l'année compte deux
    // fois, comme il fait deux déclarations de l'art. 217.
    const debutIso = iso(debut);
    const finIso = iso(fin);
    const [groupes, [entrees], [sorties]] = await Promise.all([
      this.prisma.salarie.groupBy({
        by: ['sexe', 'nationalite'],
        where: { tenantId, contrats: { some: enVigueurAu(premierJanvierSuivant) } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM "contrats_travail" c
        WHERE c."tenantId" = ${tenantId}
          AND c."dateEntreeEnVigueur"::date BETWEEN ${debutIso}::date AND ${finIso}::date
          AND NOT EXISTS (
            SELECT 1 FROM "contrats_travail" p
            WHERE p."tenantId" = ${tenantId} AND p."salarieId" = c."salarieId" AND p.id <> c.id
              AND (
                (p."dateEntreeEnVigueur"::date < c."dateEntreeEnVigueur"::date
                  AND (p."dateFin" IS NULL OR p."dateFin"::date >= c."dateEntreeEnVigueur"::date - 1))
                OR (p."dateEntreeEnVigueur"::date = c."dateEntreeEnVigueur"::date AND p.id < c.id)
              )
          )`,
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM "contrats_travail" c
        WHERE c."tenantId" = ${tenantId}
          AND c."dateFin" IS NOT NULL
          AND c."dateFin"::date BETWEEN ${debutIso}::date AND ${finIso}::date
          AND NOT EXISTS (
            SELECT 1 FROM "contrats_travail" n
            WHERE n."tenantId" = ${tenantId} AND n."salarieId" = c."salarieId" AND n.id <> c.id
              AND (
                (n."dateEntreeEnVigueur"::date <= c."dateFin"::date + 1
                  AND (n."dateFin" IS NULL OR n."dateFin"::date >= c."dateFin"::date + 1))
                OR (n."dateFin"::date = c."dateFin"::date AND n.id > c.id)
              )
          )`,
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
      au: iso(premierJanvierSuivant),
      dateLimite: dateLimiteDeclarationMainOeuvre(annee),
      effectif: somme(() => true),
      hommes: ventile('MASCULIN'),
      femmes: ventile('FEMININ'),
      sexeNonRenseigne: somme((g) => g.sexe !== 'MASCULIN' && g.sexe !== 'FEMININ'),
      sansNationalite,
      // Engagements et départs de l'année, au sens de l'art. 217 (voir plus haut).
      entrees: entrees?.n ?? 0,
      sorties: sorties?.n ?? 0,
      regleMouvements: REGLE_MOUVEMENTS_MAIN_OEUVRE,
      destinataires: DESTINATAIRES_DECLARATION_MAIN_OEUVRE,
      reserve: RESERVE_DECLARATION_MAIN_OEUVRE,
      reserveNationalite:
        sansNationalite > 0
          ? `${sansNationalite} salarié(s) de l'effectif n'ont pas de nationalité au registre · la répartition nationale et étrangère n'est pas calculée.`
          : null,
    };
  }

  /** L'identité de l'employeur que portent les deux formulaires (arrêtés n° 006 et 008). */
  private async employeurDeclare(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { nom: true, adresse: true, ville: true, telephone: true, activite: true, numeroAffiliationCnssEmployeur: true },
    });
    if (!t) throw new NotFoundException('Dossier introuvable.');
    return t;
  }

  /**
   * LA DÉCLARATION DE MOUVEMENT DU TRAVAILLEUR (art. 217 ; arrêté n° 006),
   * remplie depuis le registre pour UN contrat et le motif CHOISI.
   */
  async declarationMouvement(tenantId: string, contratId: string, motif: string) {
    const contrat = await this.prisma.contratTravail.findFirst({
      where: { id: contratId, tenantId },
      include: {
        salarie: {
          include: { _count: { select: { enfants: true } } },
        },
      },
    });
    if (!contrat) throw new NotFoundException('Contrat introuvable.');
    const refus = motifRefusMouvement(motif, { dateFin: contrat.dateFin });
    if (refus) throw new BadRequestException(refus);
    const s = contrat.salarie;
    const employeur = await this.employeurDeclare(tenantId);
    const nationalite = (s.nationalite ?? '').trim();
    const formulaire = formulaireMouvement(
      employeur,
      {
        nom: s.nom,
        postNom: s.postNom,
        prenoms: s.prenoms,
        sexe: s.sexe,
        dateNaissance: s.dateNaissance,
        millesimeNaissance: s.millesimeNaissance,
        lieuNaissance: s.lieuNaissance,
        nationalite: s.nationalite,
        numeroAffiliationCnss: s.numeroAffiliationCnss,
        nomConjoint: s.nomConjoint,
        nombreEnfants: s._count.enfants,
        etranger: nationalite ? !estNationaliteCongolaise(nationalite) : null,
      },
      {
        type: contrat.type,
        dateEntreeEnVigueur: contrat.dateEntreeEnVigueur,
        dateFin: contrat.dateFin,
        natureTravail: contrat.natureTravail,
        categorieProfessionnelle: contrat.categorieProfessionnelle,
        classeProfessionnelle: contrat.classeProfessionnelle,
        periodiciteRemuneration: contrat.periodiciteRemuneration,
        remunerationBase: contrat.remunerationBase === null ? null : Number(contrat.remunerationBase),
        deviseRemuneration: contrat.deviseRemuneration,
      },
      motif as MotifMouvement,
    );
    // Le délai et l'état se lisent par la même règle que la confrontation du registre.
    const objet = formulaire.offreAPreciser ? 'DEPART' : 'ENGAGEMENT';
    // LES DATES DE DÉCLARATION SONT TENUES PAR SALARIÉ, PAS PAR CONTRAT
    // (`Salarie.declarationEngagementLe`, `declarationDepartLe`) · elles ne se
    // lisent que contre son DERNIER contrat. Pour un contrat antérieur
    // (salarié réembauché), l'état n'est pas tenu, et c'est dit · sinon la
    // date de la seconde embauche passait pour celle de la première.
    const dernier = await this.prisma.contratTravail.findFirst({
      where: { tenantId, salarieId: s.id },
      orderBy: [{ dateEntreeEnVigueur: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    const etatTenu = dernier?.id === contrat.id;
    const due = declarationsDues(
      {
        dateEntreeEnVigueur: contrat.dateEntreeEnVigueur,
        declarationEngagementLe: s.declarationEngagementLe,
        dateFin: contrat.dateFin,
        declarationDepartLe: s.declarationDepartLe,
      },
      jourDeKinshasa(new Date()),
    ).find((d) => d.objet === objet)!;
    return {
      ...formulaire,
      echeance: iso(due.echeance),
      faiteLe: !etatTenu
        ? null
        : objet === 'ENGAGEMENT'
          ? s.declarationEngagementLe && iso(s.declarationEngagementLe)
          : s.declarationDepartLe && iso(s.declarationDepartLe),
      enRetard: etatTenu ? due.enRetard : null,
      etatNonTenu: etatTenu
        ? null
        : "Ce contrat n'est pas le dernier du salarié · la fiche ne tient la date de déclaration que pour son dernier contrat, l'état de celui-ci n'est pas lu.",
      destinataires: due.destinataires,
      delai: PRIMAUTE_DELAI_LOI,
      exemplaires: EXEMPLAIRES_MOUVEMENT,
      formulaire: FORMULAIRE_2023_NON_LU,
      derogation: contrat.type === 'JOUR_LE_JOUR' ? DEROGATION_JOUR_LE_JOUR : null,
      fondement: FONDEMENT_MOUVEMENT,
    };
  }

  /**
   * LA DÉCLARATION D'ÉTABLISSEMENT (art. 216 ; arrêté n° 008) · identité du
   * déclarant et, sur la date de l'événement, la quinzaine où elle se dépose.
   */
  async declarationEtablissement(tenantId: string, nature: string | undefined, date: string | undefined) {
    if (nature && !NATURES_ETABLISSEMENT.some((n) => n.code === nature)) {
      throw new BadRequestException('Nature inconnue · ouverture, fermeture, réouverture, déclaration à titre transitoire ou changement divers.');
    }
    const fenetre = date ? fenetreDeclarationEtablissement(date) : null;
    if (date && !fenetre) throw new BadRequestException('La date se lit AAAA-MM-JJ.');
    const employeur = await this.employeurDeclare(tenantId);
    const aujourdhui = iso(jourDeKinshasa(new Date()));
    return {
      ...formulaireEtablissement(employeur),
      // Ce que la réponse a retenu · l'écran imprime CES valeurs, jamais l'état de ses champs.
      nature: nature ?? null,
      natureLibelle: NATURES_ETABLISSEMENT.find((n) => n.code === nature)?.libelle ?? null,
      date: date ?? null,
      fenetre,
      // « Dans la quinzaine qui précède » · avant, dedans ou après, dit, jamais un refus.
      position: fenetre ? (aujourdhui < fenetre.du ? 'AVANT' : aujourdhui > fenetre.au ? 'APRES' : 'DANS') : null,
      exemplaires: EXEMPLAIRES_ETABLISSEMENT,
      formulaire: FORMULAIRE_2023_NON_LU,
      fondement: FONDEMENT_ETABLISSEMENT,
    };
  }
}
