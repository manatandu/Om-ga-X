// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { masquerLesLettrees } from './grand-livre-sans-lettrees';

/** Ligne gl-saisie, fonction 56 · le grand livre sans les écritures lettrées. */
describe('grand livre sans les écritures lettrées', () => {
  const l = (lettre: string | null, debit: number, credit: number) => ({ lettre, debit, credit, totalDebit: 0 });
  const sections = [
    // Une facture réglée (lettrée AA) et une facture ouverte.
    { id: '411A', lignes: [l('AA', 1000, 0), l('AA', 0, 1000), l(null, 500, 0)], report: null, totalDebit: 1500 },
    // Tout lettré, sans report · le compte sort de la liste.
    { id: '411B', lignes: [l('AB', 200, 0), l('AB', 0, 200)], report: null, totalDebit: 200 },
    // Tout lettré mais un report · il reste, son solde de départ se lit.
    { id: '411C', lignes: [l('AC', 0, 300)], report: { debit: 300, credit: 0 }, totalDebit: 0 },
    // Un lettrage PARTIEL ne sert pas de lettre · la ligne reste ouverte.
    { id: '401A', lignes: [l(null, 0, 900), l(null, 400, 0)], report: null, totalDebit: 400 },
  ];

  it('retire les lignes lettrées, compte et chiffre ce qu’il retire, garde les totaux du livre', () => {
    const { sections: vues, comptesEntierementLettres } = masquerLesLettrees(sections);
    expect(vues.map((v) => [v.section.id, v.section.lignes.length, v.cachees, v.debitCache, v.creditCache])).toEqual([
      ['411A', 1, 2, 1000, 1000],
      ['411C', 0, 1, 0, 300],
      ['401A', 2, 0, 0, 0],
    ]);
    expect(comptesEntierementLettres).toBe(1);
    expect(vues[0].section.totalDebit).toBe(1500);
  });
});
