import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import {
  MOTIF_DIX_SEQUENCES,
  motifRefusIntituleSequence,
  motifSequenceOccupee,
  NOMBRE_MAX_SEQUENCES,
  premierRangLibre,
} from './sequences-saisie';

/** Les séquences de saisie du dossier (ligne sage-l1, fonction 19) · voir `sequences-saisie.ts`. */
@Injectable()
export class SequencesSaisieService {
  constructor(private readonly prisma: PrismaService) {}

  /** Les dix séquences au plus, par rang, avec le nombre de modèles que chacune range. */
  async lister(tenantId: string) {
    const [sequences, parSequence] = await Promise.all([
      this.prisma.sequenceSaisie.findMany({
        where: { tenantId },
        orderBy: { numero: 'asc' },
        take: NOMBRE_MAX_SEQUENCES,
        select: { id: true, numero: true, intitule: true },
      }),
      this.prisma.modeleSaisie.groupBy({
        by: ['sequenceSaisieId'],
        where: { tenantId, sequenceSaisieId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const compte = new Map(parSequence.map((g) => [g.sequenceSaisieId, g._count._all]));
    return sequences.map((s) => ({ ...s, nombreModeles: compte.get(s.id) ?? 0 }));
  }

  /**
   * Une séquence nouvelle, au premier rang libre · sous un verrou du dossier,
   * deux créations simultanées ne prennent jamais le même rang.
   */
  async creer(tenantId: string, userId: string, intitule: string) {
    const motif = motifRefusIntituleSequence(intitule);
    if (motif) throw new BadRequestException(motif);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sequences-saisie:${tenantId}`}))`;
        const pris = await tx.sequenceSaisie.findMany({ where: { tenantId }, select: { numero: true } });
        const numero = premierRangLibre(pris.map((p) => p.numero));
        if (numero === null) throw new BadRequestException(MOTIF_DIX_SEQUENCES);
        return tx.sequenceSaisie.create({
          data: { tenantId, numero, intitule: intitule.trim(), createdBy: userId },
          select: { id: true, numero: true, intitule: true },
        });
      });
    } catch (e) {
      throw this.intituleDejaPris(e, intitule);
    }
  }

  async renommer(tenantId: string, id: string, intitule: string) {
    const motif = motifRefusIntituleSequence(intitule);
    if (motif) throw new BadRequestException(motif);
    const existante = await this.prisma.sequenceSaisie.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existante) throw new NotFoundException('Séquence de saisie introuvable');
    try {
      return await this.prisma.sequenceSaisie.update({
        where: { id },
        data: { intitule: intitule.trim() },
        select: { id: true, numero: true, intitule: true },
      });
    } catch (e) {
      throw this.intituleDejaPris(e, intitule);
    }
  }

  /** Retirée seulement si elle ne range plus aucun modèle · le refus le nomme. */
  async supprimer(tenantId: string, id: string) {
    const existante = await this.prisma.sequenceSaisie.findFirst({ where: { id, tenantId }, select: { id: true, intitule: true } });
    if (!existante) throw new NotFoundException('Séquence de saisie introuvable');
    const nombre = await this.prisma.modeleSaisie.count({ where: { tenantId, sequenceSaisieId: id } });
    if (nombre > 0) throw new ConflictException(motifSequenceOccupee(existante.intitule, nombre));
    try {
      await this.prisma.sequenceSaisie.delete({ where: { id } });
    } catch (e) {
      // UN MODÈLE RANGÉ ENTRE LE COMPTE ET LA SUPPRESSION (relecture m4) · la
      // clé étrangère refuse (P2003), et le refus se dit comme le premier,
      // recompté, au lieu d'une erreur 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        const recompte = await this.prisma.modeleSaisie.count({ where: { tenantId, sequenceSaisieId: id } });
        throw new ConflictException(motifSequenceOccupee(existante.intitule, Math.max(recompte, 1)));
      }
      throw e;
    }
    return { supprime: true };
  }

  /** Deux séquences de même intitulé rendraient la liste indéchiffrable · la base le refuse, le refus se dit. */
  private intituleDejaPris(e: unknown, intitule: string): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException(`Une séquence « ${intitule.trim()} » existe déjà dans ce dossier.`);
    }
    return e;
  }
}
