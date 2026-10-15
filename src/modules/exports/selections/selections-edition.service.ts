import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EditionSelection, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { PLAFOND_SELECTIONS, criteresSelectionOuMotif, nomOuMotif } from './selections-edition';

/**
 * LES SÉLECTIONS ENREGISTRÉES (ligne sage-l7, fonction 59) · règles et
 * décision dans `selections-edition.ts`. Chaque geste est une opération
 * UNITAIRE, au journal d'audit.
 */
@Injectable()
export class SelectionsEditionService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(tenantId: string, edition: EditionSelection) {
    const [lues, total] = await Promise.all([
      this.prisma.selectionEdition.findMany({
        where: { tenantId, edition },
        orderBy: { nom: 'asc' },
        take: PLAFOND_SELECTIONS,
        select: { id: true, edition: true, nom: true, criteres: true, creePar: true, creeLe: true, modifieLe: true },
      }),
      this.prisma.selectionEdition.count({ where: { tenantId, edition } }),
    ]);
    // Un journal retiré depuis l'enregistrement se DIT au rappel, jamais
    // remplacé en silence par « tous les journaux ».
    const journalIds = [...new Set(lues.map((s) => (s.criteres as Record<string, unknown>).journalId).filter((x): x is string => typeof x === 'string'))];
    const journaux = journalIds.length
      ? await this.prisma.journal.findMany({ where: { tenantId, id: { in: journalIds } }, select: { id: true } })
      : [];
    const presents = new Set(journaux.map((j) => j.id));
    const auteurs = await this.prisma.user.findMany({
      where: { tenantId, id: { in: [...new Set(lues.map((s) => s.creePar))] } },
      select: { id: true, email: true },
    });
    const courriel = new Map(auteurs.map((u) => [u.id, u.email]));
    return {
      selections: lues.map((s) => {
        const journalId = (s.criteres as Record<string, unknown>).journalId;
        return {
          ...s,
          creePar: courriel.get(s.creePar) ?? 'utilisateur retiré du dossier',
          journalIntrouvable: typeof journalId === 'string' && !presents.has(journalId),
        };
      }),
      total,
      tronque: total > lues.length,
    };
  }

  async creer(tenantId: string, userId: string, edition: EditionSelection, nomBrut: unknown, brut: unknown) {
    const nom = nomOuMotif(nomBrut);
    if ('motif' in nom) throw new BadRequestException(nom.motif);
    const criteres = await this.criteresDuDossier(tenantId, edition, brut);
    try {
      return await this.prisma.selectionEdition.create({
        data: { tenantId, edition, nom: nom.nom, criteres, creePar: userId },
        select: { id: true, edition: true, nom: true, criteres: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `Une sélection de cette édition porte déjà le nom « ${nom.nom} » · remplacez-la ou choisissez un autre nom.`,
        );
      }
      throw e;
    }
  }

  async remplacer(tenantId: string, id: string, brut: unknown) {
    const existante = await this.prisma.selectionEdition.findFirst({ where: { id, tenantId }, select: { id: true, edition: true } });
    if (!existante) throw new NotFoundException('Sélection introuvable pour ce dossier.');
    const criteres = await this.criteresDuDossier(tenantId, existante.edition, brut);
    return this.prisma.selectionEdition.update({
      where: { id: existante.id },
      data: { criteres, modifieLe: new Date() },
      select: { id: true, edition: true, nom: true, criteres: true },
    });
  }

  async supprimer(tenantId: string, id: string) {
    const existante = await this.prisma.selectionEdition.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existante) throw new NotFoundException('Sélection introuvable pour ce dossier.');
    await this.prisma.selectionEdition.delete({ where: { id: existante.id } });
    return { supprimee: true };
  }

  /** Les critères relus, et le journal qu'ils nomment jugé de CE dossier. */
  private async criteresDuDossier(tenantId: string, edition: EditionSelection, brut: unknown) {
    const lu = criteresSelectionOuMotif(edition, brut);
    if ('motif' in lu) throw new BadRequestException(lu.motif);
    const journalId = lu.criteres.journalId;
    if (typeof journalId === 'string') {
      const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true } });
      if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    }
    return lu.criteres as Prisma.InputJsonObject;
  }
}
