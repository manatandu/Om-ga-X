// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { filtrerBalance, totalDesRetenus, type LigneFiltrable } from './filtre-balance-tiers';

/** Ligne gl-saisie, fonction 57 · les filtres de la balance des tiers. */
describe('filtres de la balance des tiers', () => {
  const l = (id: string, x: Partial<LigneFiltrable>): LigneFiltrable & { id: string } => ({
    id,
    reportDebit: 0,
    reportCredit: 0,
    mouvementDebit: 0,
    mouvementCredit: 0,
    soldeDebit: 0,
    soldeCredit: 0,
    solde: 0,
    ...x,
  });
  const lignes = [
    // Reporté et réglé dans la période · mouvementé et soldé.
    l('regle', { reportDebit: 500, mouvementCredit: 500 }),
    // Reporté, rien dans la période · le report seul ne mouvemente pas.
    l('dort', { reportDebit: 300, soldeDebit: 300, solde: 300 }),
    // Facturé dans la période, non réglé.
    l('ouvert', { mouvementDebit: 1000, soldeDebit: 1000, solde: 1000 }),
    // Un reste d'un tiers de centime n'est pas un solde.
    l('arrondi', { mouvementDebit: 10, mouvementCredit: 9.997, solde: 0.003 }),
  ];
  const ids = (f: Parameters<typeof filtrerBalance>[1]) => filtrerBalance(lignes, f).map((x) => x.id);

  it('chaque filtre retient ce que son nom dit', () => {
    expect(ids('TOUS')).toEqual(['regle', 'dort', 'ouvert', 'arrondi']);
    expect(ids('MOUVEMENTES')).toEqual(['regle', 'ouvert', 'arrondi']);
    expect(ids('SOLDES')).toEqual(['regle', 'arrondi']);
    expect(ids('NON_SOLDES')).toEqual(['dort', 'ouvert']);
  });

  it('le total des retenus se fait au centime sur les seuls comptes retenus', () => {
    expect(totalDesRetenus(filtrerBalance(lignes, 'NON_SOLDES'))).toMatchObject({ reportDebit: 300, mouvementDebit: 1000, soldeDebit: 1300, solde: 1300 });
  });
});
