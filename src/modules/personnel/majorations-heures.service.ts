import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { NATURES_MAJORATION, libelleDesHeures, montantDesHeures, motifRefusMajoration, type NatureMajoration } from './heures-majorees';
import { MajorationHeuresDto } from './dto/majorations.dto';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · les taux de majoration du dossier et
 * les heures qu'un bulletin porte. Règles dans `heures-majorees.ts`.
 */

type Db = PrismaService | Prisma.TransactionClient;

/** Les majorations d'un dossier · quelques-unes par nature, bien en deçà. */
const PLAFOND_MAJORATIONS = 200;

/** Des heures portées par un bulletin · ce que l'élément de paie fige. */
export type HeuresPortee = {
  readonly majorationId: string;
  readonly nature: NatureMajoration;
  readonly heures: number;
  readonly tauxHoraire: number;
  readonly tauxPourCent: number;
  readonly source: string;
  readonly libelle: string;
  readonly montant: number;
};

/**
 * LES HEURES QU'UN BULLETIN PORTE, rejouées · la majoration est lue dans le
 * dossier (active, en vigueur au plus tard le dernier jour du mois), jamais
 * reçue du client.
 */
export async function heuresAPorter(
  db: Db,
  tenantId: string,
  moisDePaie: string,
  lignes: readonly { majorationId: string; heures: number; tauxHoraire: number }[],
): Promise<HeuresPortee[]> {
  const ids = [...new Set(lignes.map((l) => l.majorationId))];
  const majorations = await db.majorationHeures.findMany({ where: { tenantId, id: { in: ids } } });
  const [a, m] = moisDePaie.split('-').map(Number);
  const dernierJour = new Date(Date.UTC(a, m, 0));
  return lignes.map((l) => {
    const maj = majorations.find((x) => x.id === l.majorationId);
    if (!maj) throw new BadRequestException('Majoration introuvable dans ce dossier.');
    if (!maj.actif) throw new BadRequestException(`La majoration « ${maj.libelle} » est désactivée.`);
    if (maj.dateEffet.getTime() > dernierJour.getTime()) {
      throw new BadRequestException(`La majoration « ${maj.libelle} » prend effet le ${maj.dateEffet.toISOString().slice(0, 10)}, après ${moisDePaie}.`);
    }
    const tauxPourCent = Number(maj.tauxPourCent);
    const p = { nature: maj.nature as NatureMajoration, heures: l.heures, tauxHoraire: l.tauxHoraire, tauxPourCent };
    return {
      majorationId: maj.id,
      ...p,
      source: maj.source,
      libelle: libelleDesHeures({ ...p, libelleMajoration: maj.libelle }),
      montant: montantDesHeures(p),
    };
  });
}

@Injectable()
export class MajorationsHeuresService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(tenantId: string) {
    const lignes = await this.prisma.majorationHeures.findMany({
      where: { tenantId },
      orderBy: [{ actif: 'desc' }, { nature: 'asc' }, { dateEffet: 'desc' }],
      take: PLAFOND_MAJORATIONS,
    });
    return {
      natures: Object.entries(NATURES_MAJORATION).map(([cle, d]) => ({ cle, ...d })),
      majorations: lignes.map((x) => ({
        id: x.id,
        nature: x.nature,
        libelle: x.libelle,
        tauxPourCent: Number(x.tauxPourCent),
        source: x.source,
        dateEffet: x.dateEffet.toISOString().slice(0, 10),
        actif: x.actif,
        desactiveLe: x.desactiveLe,
        creePar: x.creePar,
      })),
      tronque: lignes.length >= PLAFOND_MAJORATIONS,
    };
  }

  async creer(tenantId: string, userEmail: string, dto: MajorationHeuresDto) {
    const refus = motifRefusMajoration(dto);
    if (refus) throw new BadRequestException(refus);
    const cree = await this.prisma.majorationHeures.create({
      data: {
        tenantId,
        nature: dto.nature,
        libelle: dto.libelle.trim(),
        tauxPourCent: new Prisma.Decimal(dto.tauxPourCent),
        source: dto.source.trim(),
        dateEffet: new Date(`${dto.dateEffet.slice(0, 10)}T00:00:00.000Z`),
        creePar: userEmail,
      },
      select: { id: true },
    });
    return cree;
  }

  /** Désactiver · jamais supprimée, les bulletins émis la nomment dans leur libellé. */
  async desactiver(tenantId: string, userEmail: string, id: string) {
    const m = await this.prisma.majorationHeures.findFirst({ where: { id, tenantId }, select: { id: true, actif: true } });
    if (!m) throw new NotFoundException('Majoration introuvable dans ce dossier.');
    if (!m.actif) throw new BadRequestException('Cette majoration est déjà désactivée.');
    await this.prisma.majorationHeures.update({ where: { id: m.id }, data: { actif: false, desactiveLe: new Date(), desactivePar: userEmail } });
    return { desactive: true };
  }
}
