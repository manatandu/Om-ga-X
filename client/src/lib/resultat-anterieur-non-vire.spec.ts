import { montant } from './montants';
import { phraseResultatEnInstance } from './resultat-anterieur-non-vire';
describe('phraseResultatEnInstance · le 130 au poste résultat (paquet 1, A6)', () => {
  it('dit le montant, le sens et le compte, sans signe', () => {
    expect(phraseResultatEnInstance(300_000)).toBe(
      `Le poste résultat comprend ${montant(300_000)} (bénéfice) au compte 130 · le résultat de l'exercice précédent, en attente de son affectation.`,
    );
    expect(phraseResultatEnInstance(-50_000)).toContain('(perte)');
  });
});
