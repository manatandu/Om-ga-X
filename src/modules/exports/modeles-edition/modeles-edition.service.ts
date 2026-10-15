import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EditionModele, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { PLAFOND_MODELES, modeleOuMotif } from './modeles-edition';

const CHAMPS = { id: true, edition: true, nom: true, colonnes: true, saut: true, creeLe: true, modifieLe: true } satisfies Prisma.ModeleEditionSelect;

/**
 * LES MODÈLES D'ÉDITION (ligne sage-l7, fonction 59) · règles et décision
 * dans `modeles-edition.ts`. Chaque geste est une opération UNITAIRE, au
 * journal d'audit.
 */
@Injectable()
export class ModelesEditionService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(tenantId: string, edition: EditionModele) {
    const [modeles, total] = await Promise.all([
      this.prisma.modeleEdition.findMany({ where: { tenantId, edition }, orderBy: { nom: 'asc' }, take: PLAFOND_MODELES, select: CHAMPS }),
      this.prisma.modeleEdition.count({ where: { tenantId, edition } }),
    ]);
    return { modeles, total, tronque: total > modeles.length };
  }

  async creer(tenantId: string, userId: string, edition: EditionModele, brut: { nom: unknown; colonnes: unknown; saut?: unknown }) {
    const lu = modeleOuMotif(edition, brut);
    if ('motif' in lu) throw new BadRequestException(lu.motif);
    try {
      return await this.prisma.modeleEdition.create({
        data: { tenantId, edition, nom: lu.nom, colonnes: lu.colonnes, saut: lu.saut, creePar: userId },
        select: CHAMPS,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Un modèle de cette édition porte déjà le nom « ${lu.nom} » · remplacez-le ou choisissez un autre nom.`);
      }
      throw e;
    }
  }

  async remplacer(tenantId: string, id: string, brut: { colonnes: unknown; saut?: unknown }) {
    const existant = await this.prisma.modeleEdition.findFirst({ where: { id, tenantId }, select: { id: true, edition: true } });
    if (!existant) throw new NotFoundException("Modèle d'édition introuvable pour ce dossier.");
    const lu = modeleOuMotif(existant.edition, brut, false);
    if ('motif' in lu) throw new BadRequestException(lu.motif);
    return this.prisma.modeleEdition.update({
      where: { id: existant.id },
      data: { colonnes: lu.colonnes, saut: lu.saut, modifieLe: new Date() },
      select: CHAMPS,
    });
  }

  async supprimer(tenantId: string, id: string) {
    const existant = await this.prisma.modeleEdition.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existant) throw new NotFoundException("Modèle d'édition introuvable pour ce dossier.");
    await this.prisma.modeleEdition.delete({ where: { id: existant.id } });
    return { supprime: true };
  }
}
