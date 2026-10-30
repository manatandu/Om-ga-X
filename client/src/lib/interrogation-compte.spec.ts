import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { lettrageDeLaLigne, sensDuSolde } from './interrogation-compte';

describe('interrogation du compte (ligne gl-saisie, fonction 13)', () => {
  it('nomme le sens du solde, soldé au centime', () => {
    expect(sensDuSolde(1500)).toBe('débiteur');
    expect(sensDuSolde(-0.5)).toBe('créditeur');
    expect(sensDuSolde(0.004)).toBe('soldé');
  });

  it('dit le lettrage de la ligne · sa lettre, ou « partiel » pour un groupe non soldé', () => {
    expect(lettrageDeLaLigne({ lettre: 'AB', lettragePartiel: false })).toBe('AB');
    expect(lettrageDeLaLigne({ lettre: null, lettragePartiel: true })).toBe('partiel');
    expect(lettrageDeLaLigne({ lettre: null, lettragePartiel: false })).toBe('');
  });

  it('la saisie l’ouvre par F2 et par double-clic sur le compte de la ligne en cours et sur la pièce', () => {
    const source = readFileSync(join(__dirname, '..', 'pages', 'SaisiePage.tsx'), 'utf8');
    expect(source).toContain("e.key === 'F2' && compteChoisi");
    expect(source).toContain('onDoubleClick={() => compteChoisi && setCompteInterroge(');
    expect(source).toContain('onDoubleClick={() => setCompteInterroge({ id: l.compteId, numero: l.numero })}');
    expect(source).toContain('<ModaleInterrogationCompte');
  });
});
