import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { OrigineDuMontant } from './origine-des-montants';

/**
 * LE COMPTE DU PLAN DERRIÈRE CHAQUE NUMÉRO · la remontée d'un montant ouvre
 * ensuite le grand livre du compte (`GET /ecritures/grand-livre/:compteId`),
 * qui se lit par identifiant. Les états ne portent que le numéro · il est
 * résolu ici, sur le plan du DOSSIER de la session et sur lui seul, pour les
 * seuls numéros que l'origine cite. Un numéro qui n'y est plus reste sans
 * identifiant, et l'écran le dit au lieu d'ouvrir un grand livre vide.
 */
@Injectable()
export class ComptesDuZoomService {
  constructor(private readonly prisma: PrismaService) {}

  async attacher(tenantId: string, origine: OrigineDuMontant): Promise<OrigineDuMontant> {
    const numeros = [...new Set(origine.groupes.flatMap((g) => g.comptes.map((c) => c.numero)))];
    if (numeros.length === 0) return origine;
    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, numero: { in: numeros } },
      select: { id: true, numero: true },
    });
    const parNumero = new Map(comptes.map((c) => [c.numero, c.id]));
    return {
      ...origine,
      groupes: origine.groupes.map((g) => ({
        ...g,
        comptes: g.comptes.map((c) => ({ ...c, compteId: parNumero.get(c.numero) ?? null })),
      })),
    };
  }
}
