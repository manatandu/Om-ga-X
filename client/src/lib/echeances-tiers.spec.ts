// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { libelleJoursRestants, libelleSens } from './echeances-tiers';

/** Ligne gl-saisie, fonction 34 · les échéances proches des tiers au tableau de bord. */
describe('échéances des tiers au tableau de bord', () => {
  it('dit le délai et le sens', () => {
    expect(libelleJoursRestants(0)).toBe('aujourd’hui');
    expect(libelleJoursRestants(1)).toBe('demain');
    expect(libelleJoursRestants(9)).toBe('dans 9 j');
    expect(libelleSens('A_ENCAISSER')).toBe('à encaisser');
    expect(libelleSens('A_PAYER')).toBe('à payer');
  });

  it('le tableau de bord lit le serveur et dit un échec, jamais un poste apuré', () => {
    const source = readFileSync(join(__dirname, '..', 'pages', 'DashboardPage.tsx'), 'utf8');
    expect(source).toContain('`/echeances-tiers?exerciceId=${exerciceCourant.id}`');
    expect(source).toContain('Échéances des tiers illisibles');
    expect(source).toContain('sans échéance, non comptée');
  });
});
