import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FormeImpressionJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { PLAFOND_ECRITURES_PAR_FENETRE, perimetreJournal } from '../comptabilite/ecriture.service';
import { enregistrerImpression, periodeCouverte } from './impressions-journal';
import { ImprimerJournalDto } from './dto/impression-journal.dto';

/** Au-delà, la liste des impressions se tronque et le dit (§ 8 bis). */
export const PLAFOND_IMPRESSIONS_LISTEES = 200;

const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * LES IMPRESSIONS DU JOURNAL (ligne sage-l1, fonction 60) · voir
 * `impressions-journal.ts` pour la décision par la loi.
 */
@Injectable()
export class ImpressionsJournalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * L'IMPRESSION DE LA FENÊTRE · enregistrée AVANT la boîte d'impression,
   * comme l'ordre de virement (« imprimé », date, auteur). La fenêtre ne
   * montre qu'une tranche au-delà de son plafond · une impression qui n'en
   * porterait qu'une partie n'atteste pas le journal, elle est refusée, avec
   * le chemin de rechange (l'export, enregistré lui aussi).
   */
  async imprimer(tenantId: string, userId: string, dto: ImprimerJournalDto) {
    const exercice = await this.prisma.exercice.findFirst({
      where: { id: dto.exerciceId, tenantId },
      select: { id: true, dateDebut: true, dateFin: true },
    });
    if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    const journalId = dto.journalId ?? null;
    if (journalId) {
      const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true } });
      if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    }
    const periode = periodeCouverte(exercice, dto);
    const nombreEcritures = await this.prisma.ecriture.count({
      where: perimetreJournal(tenantId, {
        exerciceId: exercice.id,
        ...(journalId ? { journalId } : {}),
        dateDebut: jour(periode.dateDebut),
        dateFin: jour(periode.dateFin),
      }),
    });
    if (nombreEcritures > PLAFOND_ECRITURES_PAR_FENETRE) {
      throw new BadRequestException(
        `Le journal de cette période porte ${nombreEcritures.toLocaleString('fr-FR')} pièces, au-delà de ce que la fenêtre ` +
          `affiche (${PLAFOND_ECRITURES_PAR_FENETRE.toLocaleString('fr-FR')}) · son impression n'en montrerait qu'une partie. ` +
          "Exportez-le en Excel · l'export le rend en entier et s'enregistre comme impression.",
      );
    }
    return enregistrerImpression(this.prisma, {
      tenantId,
      exerciceId: exercice.id,
      journalId,
      dateDebut: periode.dateDebut,
      dateFin: periode.dateFin,
      forme: FormeImpressionJournal.IMPRESSION,
      nombreEcritures,
      imprimePar: userId,
    });
  }

  /** Les impressions de l'exercice, les plus récentes d'abord, avec leur auteur en courriel. */
  async lister(tenantId: string, exerciceId: string) {
    const [impressions, total] = await Promise.all([
      this.prisma.impressionJournal.findMany({
        where: { tenantId, exerciceId },
        orderBy: { numero: 'desc' },
        take: PLAFOND_IMPRESSIONS_LISTEES,
        include: { journal: { select: { code: true } } },
      }),
      this.prisma.impressionJournal.count({ where: { tenantId, exerciceId } }),
    ]);
    const auteurs = await this.prisma.user.findMany({
      where: { tenantId, id: { in: [...new Set(impressions.map((i) => i.imprimePar))] } },
      select: { id: true, email: true },
    });
    const courriel = new Map(auteurs.map((u) => [u.id, u.email]));
    return {
      impressions: impressions.map((i) => ({
        id: i.id,
        numero: i.numero,
        journal: i.journal?.code ?? null,
        dateDebut: i.dateDebut,
        dateFin: i.dateFin,
        forme: i.forme,
        nombreEcritures: i.nombreEcritures,
        imprimeAt: i.imprimeAt,
        imprimePar: courriel.get(i.imprimePar) ?? 'utilisateur retiré du dossier',
      })),
      total,
      tronque: total > impressions.length,
    };
  }
}
