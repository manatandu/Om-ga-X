import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { contratCouvrantLeMois, moisValide } from './bulletin-paie';
import {
  EVENEMENTS_CIRCONSTANCE,
  NATURES_ABSENCE,
  iso,
  joursDeLAbsence,
  joursOuvrables,
  joursOuvrablesDuMois,
  jourUtc,
  motifRefusAbsence,
  motifRefusIndemniteCaisse,
  propositionDuMois,
  type AbsenceLue,
} from './absences';
import { plusMois } from './remuneration-du-delai';
import { PLAFOND_ABSENCES_SALARIE, absencesDuSalarie } from './absences-lecture';
import { AbsenceSalarieDto, IndemniteCaisseDto } from './dto/absences.dto';
import { Prisma } from '@prisma/client';

/** Ce que le texte dit d'un arrêt qui dure · une information, jamais un refus. */
function informationsDeLArret(nature: string, du: Date, au: Date): string[] {
  const sixMois = plusMois(du, 6);
  if (au.getTime() < sixMois.getTime()) return [];
  const le = iso(sixMois);
  if (nature === 'MALADIE_OU_ACCIDENT') {
    return [
      `Six mois ininterrompus d'incapacité au ${le} · l'employeur peut notifier la résiliation, avec une indemnité égale au préavis (Code du travail, art. 60, a).`,
    ];
  }
  if (nature === 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE') {
    return [
      `Les deux tiers dus par l'employeur s'arrêtent au ${le}, après six mois (Code du travail, art. 106) ; l'indemnité journalière de la Caisse continue jusqu'à la guérison ou jusqu'à la rente qui la remplace (arrêté n° 146/2018, art. 87, 88 et 166).`,
    ];
  }
  return [];
}

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 1 · les absences du salarié. Les règles
 * sont dans `absences.ts` ; ce service lit, rejoue et enregistre.
 */
@Injectable()
export class AbsencesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Les natures et les événements, tels que le texte les nomme · servis à l'écran, jamais recopiés. */
  catalogue() {
    return {
      natures: Object.entries(NATURES_ABSENCE).map(([cle, d]) => ({ cle, ...d })),
      evenements: Object.entries(EVENEMENTS_CIRCONSTANCE).map(([cle, e]) => ({ cle, ...e })),
    };
  }

  /** Les absences d'un salarié, annulées comprises, avec leurs jours comptés. */
  async lister(tenantId: string, salarieId: string) {
    await this.salarie(tenantId, salarieId);
    const [lignes, total] = await Promise.all([
      this.prisma.absenceSalarie.findMany({
        where: { tenantId, salarieId },
        orderBy: { du: 'desc' },
        take: PLAFOND_ABSENCES_SALARIE,
        include: { indemnitesCaisse: { orderBy: { mois: 'asc' }, take: 120 } },
      }),
      this.prisma.absenceSalarie.count({ where: { tenantId, salarieId } }),
    ]);
    return {
      absences: lignes.map((a) => {
        const jours = joursDeLAbsence({ du: iso(a.du), au: iso(a.au), demiJourneeDebut: a.demiJourneeDebut, demiJourneeFin: a.demiJourneeFin });
        const def = NATURES_ABSENCE[a.nature];
        return {
          id: a.id,
          nature: a.nature,
          libelle: def.libelle,
          fondement: def.fondement,
          regime: def.regime,
          du: iso(a.du),
          au: iso(a.au),
          demiJourneeDebut: a.demiJourneeDebut,
          demiJourneeFin: a.demiJourneeFin,
          evenement: a.evenement,
          piece: a.piece,
          observation: a.observation,
          joursOuvrables: 'refus' in jours ? null : joursOuvrables(jours),
          joursCalendaires: 'refus' in jours ? null : jours.length,
          annuleLe: a.annuleLe,
          motifAnnulation: a.motifAnnulation,
          creePar: a.creePar,
          informations: a.annuleLe ? [] : informationsDeLArret(a.nature, a.du, a.au),
          indemnitesCaisse: a.indemnitesCaisse.map((i) => ({
            id: i.id,
            mois: i.mois,
            montant: Number(i.montant),
            traitement: i.traitement,
            piece: i.piece,
            annuleLe: i.annuleLe,
            motifAnnulation: i.motifAnnulation,
          })),
        };
      }),
      total,
      tronque: total > lignes.length,
    };
  }

  /** Déclarer une absence · bornée par ce que le texte borne, jamais sur un jour hors contrat. */
  async creer(tenantId: string, userEmail: string, salarieId: string, dto: AbsenceSalarieDto) {
    const salarie = await this.salarie(tenantId, salarieId);
    const du = jourUtc(dto.du.slice(0, 10));
    const au = jourUtc(dto.au.slice(0, 10));
    if (!du || !au) throw new BadRequestException("Les dates de l'absence se lisent AAAA-MM-JJ.");
    const couvre = salarie.contrats.some(
      (c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= au.getTime()),
    );
    if (!couvre) throw new BadRequestException("Aucun contrat ne couvre l'absence du début à la fin · une absence suspend ou interrompt un contrat en cours.");
    const autres = await absencesDuSalarie(this.prisma, tenantId, salarieId);
    const absence: AbsenceLue & { evenement: string | null; piece: string | null } = {
      id: '',
      nature: dto.nature,
      du: iso(du),
      au: iso(au),
      demiJourneeDebut: dto.demiJourneeDebut === true,
      demiJourneeFin: dto.demiJourneeFin === true,
      evenement: dto.evenement ?? null,
      piece: dto.piece?.trim() || null,
    };
    const refus = motifRefusAbsence(absence, autres);
    if (refus) throw new BadRequestException(refus);
    // UN JOUR N'A QU'UNE CAUSE · un congé payé ne chevauche une absence que
    // pour la maladie qui le traverse (art. 141, al. 4, « Les jours de
    // maladie [...] ne sont pas comptés comme jours de congé »).
    if (!NATURES_ABSENCE[dto.nature].maladie) {
      const conge = await this.prisma.congeSalarie.findFirst({
        where: { tenantId, salarieId, annuleLe: null, du: { lte: au }, au: { gte: du } },
        select: { du: true, au: true },
      });
      if (conge) {
        throw new BadRequestException(
          `L'absence chevauche le congé du ${iso(conge.du)} au ${iso(conge.au)} · seule la maladie survenue pendant un congé s'y déclare (Code du travail, art. 141, al. 4).`,
        );
      }
    }
    const cree = await this.prisma.absenceSalarie.create({
      data: {
        tenantId,
        salarieId,
        nature: dto.nature,
        du,
        au,
        demiJourneeDebut: absence.demiJourneeDebut,
        demiJourneeFin: absence.demiJourneeFin,
        evenement: dto.nature === 'CONGE_DE_CIRCONSTANCE' ? (dto.evenement ?? null) : null,
        piece: absence.piece,
        observation: dto.observation?.trim() || null,
        creePar: userEmail,
      },
      select: { id: true },
    });
    return { id: cree.id };
  }

  /** Annuler une absence · jamais supprimée, marquée avec son motif (journal d'audit). */
  async annuler(tenantId: string, userEmail: string, id: string, motif: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      const a = await tx.absenceSalarie.findFirst({ where: { id, tenantId }, select: { id: true, annuleLe: true } });
      if (!a) throw new NotFoundException('Absence introuvable dans ce dossier.');
      if (a.annuleLe) throw new BadRequestException('Cette absence est déjà annulée.');
      await tx.absenceSalarie.update({ where: { id: a.id }, data: { annuleLe: new Date(), annulePar: userEmail, motifAnnulation: motif.trim() } });
      return { annule: true };
    });
  }

  /**
   * LES ABSENCES D'UN MOIS ET LA PROPOSITION DU BULLETIN · servies à
   * l'onglet Simulation. Proposées, jamais substituées · le cabinet les
   * reprend au clic. La moyenne de l'art. 66 se déclare à l'appel.
   */
  async duMois(tenantId: string, salarieId: string, mois: string, moyenneBrute?: string) {
    if (!moisValide(mois)) throw new BadRequestException('Le mois de paie se lit AAAA-MM.');
    let moyenne: number | null = null;
    if (moyenneBrute !== undefined && moyenneBrute.trim() !== '') {
      moyenne = Number(moyenneBrute.replace(',', '.'));
      if (!Number.isFinite(moyenne) || moyenne < 0) throw new BadRequestException("La moyenne mensuelle de l'art. 66 est un montant positif ou nul.");
    }
    const salarie = await this.salarie(tenantId, salarieId);
    const absences = await absencesDuSalarie(this.prisma, tenantId, salarieId);
    // ÉTAPE 3 · les indemnités de la Caisse déclarées pour ce mois.
    const indemnites = await this.prisma.indemniteCaisseAbsence.findMany({
      where: { tenantId, mois, annuleLe: null, absenceId: { in: absences.map((a) => a.id) } },
      select: { absenceId: true, montant: true, traitement: true },
    });
    const subrogees = new Set(indemnites.filter((i) => i.traitement === 'SUBROGATION').map((i) => i.absenceId));
    const deductionsParAbsence = new Map<string, number>();
    for (const i of indemnites.filter((x) => x.traitement === 'DEDUITE')) {
      deductionsParAbsence.set(i.absenceId, (deductionsParAbsence.get(i.absenceId) ?? 0) + Number(i.montant));
    }
    const aRecevoirDeLaCaisse = indemnites
      .filter((i) => i.traitement === 'SUBROGATION' || i.traitement === 'SUBROGATION_PARTIELLE')
      .reduce((n, i) => n + Number(i.montant), 0);
    const jours = joursOuvrablesDuMois(absences, mois, subrogees);
    const contrat = contratCouvrantLeMois(salarie.contrats, mois);
    const salaireMensuel =
      contrat && contrat.periodiciteRemuneration === 'MOIS' && contrat.remunerationBase !== null ? Number(contrat.remunerationBase) : null;
    const proposition = propositionDuMois({ jours, salaireMensuel, moyenneMensuelleArticle66: moyenne, deductionsParAbsence, aRecevoirDeLaCaisse });
    const duMois = absences.filter((a) => a.au.slice(0, 7) >= mois && a.du.slice(0, 7) <= mois);
    return {
      mois,
      devise: contrat?.deviseRemuneration ?? null,
      salaireMensuel,
      absences: duMois.map((a) => {
        const siens = jours.filter((j) => j.absenceId === a.id);
        return {
          id: a.id,
          nature: a.nature,
          libelle: NATURES_ABSENCE[a.nature].libelle,
          du: a.du,
          au: a.au,
          joursDuMois: siens.reduce((n, j) => n + j.poids, 0),
          regimes: [...new Set(siens.map((j) => j.regime))],
        };
      }),
      proposition,
    };
  }

  /**
   * ÉTAPE 3 · DÉCLARER L'INDEMNITÉ DE LA CAISSE d'un mois d'arrêt · jamais
   * calculée (la Caisse la liquide), toujours avec sa pièce. Une par arrêt et
   * par mois ; elle s'annule pour se corriger.
   */
  async declarerIndemniteCaisse(tenantId: string, userEmail: string, absenceId: string, dto: IndemniteCaisseDto) {
    return transactionJournalisee(this.prisma, async (tx) => {
      const a = await tx.absenceSalarie.findFirst({
        where: { id: absenceId, tenantId },
        select: { id: true, nature: true, du: true, au: true, annuleLe: true },
      });
      if (!a) throw new NotFoundException('Arrêt introuvable dans ce dossier.');
      if (a.annuleLe) throw new BadRequestException('Cet arrêt est annulé.');
      const deja = await tx.indemniteCaisseAbsence.findFirst({ where: { tenantId, absenceId, mois: dto.mois, annuleLe: null }, select: { id: true } });
      const refus = motifRefusIndemniteCaisse({
        nature: a.nature,
        du: iso(a.du),
        au: iso(a.au),
        mois: dto.mois,
        montant: dto.montant,
        traitement: dto.traitement,
        piece: dto.piece,
        dejaDeclareCeMois: deja !== null,
      });
      if (refus) throw new BadRequestException(refus);
      return tx.indemniteCaisseAbsence.create({
        data: {
          tenantId,
          absenceId,
          mois: dto.mois,
          montant: new Prisma.Decimal(dto.montant),
          traitement: dto.traitement,
          piece: dto.piece.trim(),
          creePar: userEmail,
        },
        select: { id: true },
      });
    });
  }

  async annulerIndemniteCaisse(tenantId: string, userEmail: string, id: string, motif: string) {
    const i = await this.prisma.indemniteCaisseAbsence.findFirst({ where: { id, tenantId }, select: { id: true, annuleLe: true } });
    if (!i) throw new NotFoundException('Indemnité introuvable dans ce dossier.');
    if (i.annuleLe) throw new BadRequestException('Cette indemnité est déjà annulée.');
    await this.prisma.indemniteCaisseAbsence.update({ where: { id: i.id }, data: { annuleLe: new Date(), annulePar: userEmail, motifAnnulation: motif.trim() } });
    return { annule: true };
  }

  private async salarie(tenantId: string, salarieId: string) {
    const s = await this.prisma.salarie.findFirst({
      where: { id: salarieId, tenantId },
      select: {
        id: true,
        contrats: {
          select: {
            id: true,
            dateEntreeEnVigueur: true,
            dateFin: true,
            renouvelleDeId: true,
            remunerationBase: true,
            periodiciteRemuneration: true,
            deviseRemuneration: true,
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    return s;
  }
}
