import { motifRefusMontantDuGroupe } from './lettrage-partiel';

/**
 * Relevé de la ligne lettrage-cloture · le refus en devise disait « en a déjà
 * réglé 1680000.00 » en FRANCS à côté d'un reste en devise, sans le dire.
 */
describe('refus au-delà du reste d’un lettrage partiel · les deux unités se nomment', () => {
  it('en devise, le déjà-réglé est dit en francs au coût historique', () => {
    const m = motifRefusMontantDuGroupe('41110000', 700, 600, 'B', 1_680_000, true);
    expect(m).toContain('dans la devise des factures');
    expect(m).toContain('1680000.00 en francs, au coût historique');
  });

  it('en francs, rien ne change', () => {
    const m = motifRefusMontantDuGroupe('41110000', 20, 10, 'B', 5);
    expect(m).not.toContain('coût historique');
    expect(motifRefusMontantDuGroupe('41110000', 10, 10, 'B', 5)).toBeNull();
  });
});
