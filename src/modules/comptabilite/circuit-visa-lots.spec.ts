import { ConflictException } from '@nestjs/common';
import { CircuitVisaService } from './circuit-visa.service';
import type { PrismaService } from '../../common/prisma.service';

/**
 * UN LOT DE VISAS NE TOMBE PAS SUR UNE PIÈCE (relecture du circuit, mineur) ·
 * chaque pièce a sa transaction · un 409 ou une panne au milieu du lot
 * faisait tomber la requête entière, et l'écran ne voyait jamais les visas
 * déjà posés. Tout refus est rangé avec son motif, la panne dite pour sa pièce.
 */
function monter(issues: Array<'ok' | 'conflit' | 'panne'>) {
  let rang = 0;
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ circuitVisa: true }) },
    $transaction: jest.fn(async () => {
      const issue = issues[rang++];
      if (issue === 'conflit') throw new ConflictException('Pièce verrouillée par un autre geste.');
      if (issue === 'panne') throw new Error('connexion perdue');
      return { piece: 'OD n° 1', motif: null, avertissement: null };
    }),
  };
  return new CircuitVisaService(prisma as unknown as PrismaService);
}

describe('un lot de visas range chaque refus, et garde ce qui est fait', () => {
  it('viser · le premier visa posé reste dit, le 409 et la panne sont rangés', async () => {
    const r = await monter(['ok', 'conflit', 'panne']).viserEcritures('t', 'B', [
      { id: 'a', empreinte: 'x' },
      { id: 'b', empreinte: 'y' },
      { id: 'c', empreinte: 'z' },
    ]);
    expect(r.visees).toBe(1);
    expect(r.refusees.map((x) => [x.id, x.motif])).toEqual([
      ['b', 'Pièce verrouillée par un autre geste.'],
      ['c', expect.stringMatching(/consigné au journal du serveur/)],
    ]);
  });

  it('retirer · même règle', async () => {
    const r = await monter(['conflit', 'ok']).retirerVisas('t', { userId: 'B', role: 'COMPTABLE' }, ['a', 'b']);
    expect(r.retires).toBe(1);
    expect(r.refusees).toEqual([{ id: 'a', piece: '·', motif: 'Pièce verrouillée par un autre geste.' }]);
  });
});
