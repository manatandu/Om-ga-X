import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PLAFOND_PLANS_LUS, RepartitionsAnalytiquesPaieService } from './repartitions-analytiques-paie.service';

/**
 * LIGNE SAGE-L5, FONCTION 88 · le câblage de la répartition · la règle est
 * rejouée sur le plan et les sections RELUS dans le dossier, une version ne
 * se déclare pas deux fois (ni par la lecture, ni par l'index unique), se
 * retire une fois, et la passation ne ventile rien au-delà de sa borne.
 */
const PLAN = { id: 'p1', code: 'PROJ', classesVentilees: '2,6,7', estActif: true };
const SECTIONS = [
  { id: 's1', planId: 'p1', code: 'P1', type: 'DETAIL', estActive: true },
  { id: 's2', planId: 'p1', code: 'P2', type: 'DETAIL', estActive: true },
];

function monter(o: { existante?: boolean; doublon?: boolean; retiree?: boolean; plans?: number } = {}) {
  const prisma = {
    salarie: { findFirst: jest.fn().mockResolvedValue({ id: 'sa1' }) },
    planAnalytique: {
      findFirst: jest.fn().mockResolvedValue(PLAN),
      findMany: jest.fn().mockResolvedValue(
        Array.from({ length: o.plans ?? 1 }, (_, i) => ({ ...PLAN, id: `p${i + 1}`, ventilationObligatoire: false })),
      ),
    },
    sectionAnalytique: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => SECTIONS.filter((s) => where.id.in.includes(s.id))),
    },
    repartitionAnalytiquePaie: {
      findFirst: jest.fn(async ({ where }: { where: { retireLe?: null } }) =>
        'retireLe' in where ? (o.existante ? { id: 'v0' } : null) : { id: 'v1', retireLe: o.retiree ? new Date() : null },
      ),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async () => {
        if (o.doublon) throw new Prisma.PrismaClientKnownRequestError('doublon', { code: 'P2002', clientVersion: '5' });
        return { id: 'v2', moisEffet: '2026-12' };
      }),
      update: jest.fn().mockResolvedValue({ id: 'v1', retireLe: new Date() }),
    },
  };
  return { service: new RepartitionsAnalytiquesPaieService(prisma as never), prisma };
}

const dto = (lignes: [string, number][]) => ({ planId: 'p1', moisEffet: '2026-12', lignes: lignes.map(([sectionId, pourcentage]) => ({ sectionId, pourcentage })) });

describe('la répartition analytique déclarée', () => {
  it('écrit la version et ses parts, à deux décimales, dans le dossier de la session', async () => {
    const { service, prisma } = monter();
    await service.declarer('t1', 'u1', 'sa1', dto([['s1', 60], ['s2', 40]]));
    expect(prisma.repartitionAnalytiquePaie.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          salarieId: 'sa1',
          planId: 'p1',
          moisEffet: '2026-12',
          lignes: { create: [expect.objectContaining({ tenantId: 't1', sectionId: 's1' }), expect.objectContaining({ sectionId: 's2' })] },
        }),
      }),
    );
    expect(prisma.planAnalytique.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', tenantId: 't1' } }));
  });

  it('refuse ce qui ne fait pas 100 %, et une section qui n’est pas lue dans le dossier', async () => {
    await expect(monter().service.declarer('t1', 'u1', 'sa1', dto([['s1', 60], ['s2', 30]]))).rejects.toBeInstanceOf(BadRequestException);
    await expect(monter().service.declarer('t1', 'u1', 'sa1', dto([['ailleurs', 100]]))).rejects.toThrow(/n'appartient pas au plan PROJ/);
  });

  it('une version du même mois refuse · à la lecture comme à l’index unique', async () => {
    await expect(monter({ existante: true }).service.declarer('t1', 'u1', 'sa1', dto([['s1', 100]]))).rejects.toBeInstanceOf(ConflictException);
    await expect(monter({ doublon: true }).service.declarer('t1', 'u1', 'sa1', dto([['s1', 100]]))).rejects.toBeInstanceOf(ConflictException);
  });

  it('se retire une fois, par une mise à jour unitaire du dossier', async () => {
    const { service, prisma } = monter();
    await service.retirer('t1', 'u1', 'v1', '  Projet clos  ');
    expect(prisma.repartitionAnalytiquePaie.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v1', tenantId: 't1' }, data: expect.objectContaining({ retirePar: 'u1', motifRetrait: 'Projet clos' }) }),
    );
    await expect(monter({ retiree: true }).service.retirer('t1', 'u1', 'v1', 'motif')).rejects.toBeInstanceOf(ConflictException);
  });

  it('la passation ne ventile rien au-delà de la borne des plans · rien d’ignoré en silence', async () => {
    expect(await monter({ plans: PLAFOND_PLANS_LUS + 1 }).service.pourLaPassation('t1', '2026-12', ['sa1'])).toBeNull();
    expect(await monter({ plans: 1 }).service.pourLaPassation('t1', '2026-12', ['sa1'])).toMatchObject({ versions: [], obligatoires: [] });
  });
});
