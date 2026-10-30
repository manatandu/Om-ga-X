import { filtrerBalance, lireFiltreBalance, passeLeFiltre } from './filtres-balance-analytique';

/**
 * Fonction n° 53 · ce qui casserait en silence · un filtre inconnu lu comme
 * « toutes » (la balance aurait l'air filtrée), un solde de 0,004 tenu pour
 * non soldé, et un compte de lignes masquées qui ne serait plus dit.
 */
describe('filtres de la balance analytique (fonction n° 53)', () => {
  const lignes = [
    { code: 'A', debit: 0, credit: 0, solde: 0 },
    { code: 'B', debit: 100, credit: 100, solde: 0 },
    { code: 'C', debit: 250, credit: 50, solde: 200 },
    { code: 'D', debit: 0.1 + 0.2, credit: 0.3, solde: 0.1 + 0.2 - 0.3 },
  ];

  it('lit le filtre · absent vaut toutes, inconnu vaut null', () => {
    expect(lireFiltreBalance(undefined)).toBe('TOUTES');
    expect(lireFiltreBalance('')).toBe('TOUTES');
    expect(lireFiltreBalance('mouvementees')).toBe('MOUVEMENTEES');
    expect(lireFiltreBalance('NON_SOLDEES')).toBe('NON_SOLDEES');
    expect(lireFiltreBalance('soldees')).toBeNull();
  });

  it('mouvementées · débit ou crédit non nul, même soldée', () => {
    const r = filtrerBalance(lignes, 'MOUVEMENTEES');
    expect(r.lignes.map((l) => l.code)).toEqual(['B', 'C', 'D']);
    expect(r.masquees).toBe(1);
  });

  it('non soldées · le zéro se juge au centime', () => {
    expect(passeLeFiltre(lignes[3], 'NON_SOLDEES')).toBe(false);
    const r = filtrerBalance(lignes, 'NON_SOLDEES');
    expect(r.lignes.map((l) => l.code)).toEqual(['C']);
    expect(r.masquees).toBe(3);
  });

  it('toutes · rien de masqué', () => {
    expect(filtrerBalance(lignes, 'TOUTES')).toEqual({ lignes, masquees: 0 });
  });
});
