import { PrismaService } from '../../common/prisma.service';
import { motifCompteHorsSaisie } from './compte-de-saisie';

/**
 * Relecture du 2026-10-30 · une grille ou un budget posé sur un compte que la
 * saisie refuse se lirait comme une décision valable · grille jamais
 * proposée, budget à zéro de réalisé pendant que le sous-compte sortait hors
 * budget. Le refus nomme le sous-compte.
 */
function prismaAvec(sousComptes: string[]) {
  return {
    tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    compte: { findMany: jest.fn().mockResolvedValue(sousComptes.map((numero) => ({ numero }))) },
  } as unknown as PrismaService;
}

describe('compte que la saisie admet (grille, budget)', () => {
  it('un compte en sommeil est refusé', async () => {
    await expect(motifCompteHorsSaisie(prismaAvec([]), 't1', { id: 'c', numero: '60410000', estActif: false }, 'la grille')).resolves.toMatch(
      /en sommeil/,
    );
  });

  it('un compte du plan subdivisé est refusé, le sous-compte nommé', async () => {
    await expect(
      motifCompteHorsSaisie(prismaAvec(['60410001', '60410002']), 't1', { id: 'c', numero: '60410000', estActif: true }, 'le budget'),
    ).resolves.toMatch(/subdivisé.*60410001, 60410002\), le budget se pose/);
  });

  it('un compte du plan sans sous-compte, ou un sous-compte du dossier, passe', async () => {
    await expect(motifCompteHorsSaisie(prismaAvec([]), 't1', { id: 'c', numero: '60410000', estActif: true }, 'la grille')).resolves.toBeNull();
    await expect(motifCompteHorsSaisie(prismaAvec(['x']), 't1', { id: 'c', numero: '60410001', estActif: true }, 'la grille')).resolves.toBeNull();
  });
});
