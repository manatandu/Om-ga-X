import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GranulariteCloture } from '@prisma/client';
import { refuserSiDernierJourClos } from './cloture-du-dernier-jour';
import type { PrismaService } from '../../common/prisma.service';

/**
 * Ce qui casserait en silence (second tour, M1) · la régularisation et la
 * revue se datent du dernier jour de l'exercice ; décembre clos, la saisie
 * renvoyait l'aide du report de l'art. 22, 4°, qui ne mène nulle part. Le
 * refus doit nommer la seule issue, et laisser passer une période ouverte.
 */
const prismaAvec = (clotures: { granularite: GranulariteCloture; journalId: string | null; dateLimite: Date }[]) => {
  const findMany = jest.fn().mockResolvedValue(clotures);
  return { prisma: { cloture: { findMany } } as unknown as PrismaService, findMany };
};
const fin = new Date('2026-12-31T00:00:00.000Z');

describe('refuserSiDernierJourClos', () => {
  it('laisse passer quand aucune clôture ne couvre le dernier jour', async () => {
    const { prisma, findMany } = prismaAvec([{ granularite: GranulariteCloture.PERIODE, journalId: null, dateLimite: new Date('2026-11-30T00:00:00.000Z') }]);
    await expect(refuserSiDernierJourClos(prisma, 't1', 'od', fin, 'la régularisation')).resolves.toBeUndefined();
    expect(findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', annuleeAt: null });
  });

  it('refuse en nommant la clôture de l’exercice quand décembre est clos pour tous les journaux', async () => {
    const { prisma } = prismaAvec([{ granularite: GranulariteCloture.PERIODE, journalId: null, dateLimite: fin }]);
    const e = await refuserSiDernierJourClos(prisma, 't1', 'od', fin, 'la régularisation').catch((x) => x);
    expect(e).toBeInstanceOf(BadRequestException);
    expect(e.message).toContain('Clôturez l');
    expect(e.message).toContain('AUDCIF art. 34');
    expect(e.message).not.toContain('premier jour ouvert');
  });

  it('refuse aussi quand le journal d’opérations diverses est clôturé totalement à cette date', async () => {
    const { prisma } = prismaAvec([{ granularite: GranulariteCloture.TOTALE, journalId: 'od', dateLimite: fin }]);
    await expect(refuserSiDernierJourClos(prisma, 't1', 'od', fin, 'la revue')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('laisse remonter une erreur qui n’est pas un refus de période', async () => {
    const prisma = { cloture: { findMany: jest.fn().mockRejectedValue(new NotFoundException('x')) } } as unknown as PrismaService;
    await expect(refuserSiDernierJourClos(prisma, 't1', 'od', fin, 'la revue')).rejects.toBeInstanceOf(NotFoundException);
  });
});
