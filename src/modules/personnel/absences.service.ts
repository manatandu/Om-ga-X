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
  propositionDuMois,
  type AbsenceLue,
} from './absences';
import { PLAFOND_ABSENCES_SALARIE, absencesDuSalarie } from './absences-lecture';
import { AbsenceSalarieDto } from './dto/absences.dto';

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
    const jours = joursOuvrablesDuMois(absences, mois);
    const contrat = contratCouvrantLeMois(salarie.contrats, mois);
    const salaireMensuel =
      contrat && contrat.periodiciteRemuneration === 'MOIS' && contrat.remunerationBase !== null ? Number(contrat.remunerationBase) : null;
    const proposition = propositionDuMois({ jours, salaireMensuel, moyenneMensuelleArticle66: moyenne });
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
