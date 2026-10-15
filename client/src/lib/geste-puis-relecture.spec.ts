import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisRelectureManquee, gestePuisRelecture } from './geste-puis-relecture';

/**
 * RELECTURE « ÉCHECS SILENCIEUX » DE LA LIGNE SAGE-L2, m6 · un geste
 * enregistré dont la relecture échoue était dit en échec, et l'écran
 * rétablissait la valeur d'avant.
 */
const message = (e: unknown) => (e instanceof Error ? e.message : null);

describe('un geste, puis sa relecture', () => {
  it('un geste refusé est en échec, et rien n’est relu', async () => {
    let relectures = 0;
    const relire = async () => {
      relectures += 1;
    };
    const r = await gestePuisRelecture(async () => Promise.reject(new Error('Code déjà pris')), relire, message);
    expect(r).toEqual({ fait: false, erreurGeste: 'Code déjà pris', erreurRelecture: null });
    expect(relectures).toBe(0);
  });

  it('un geste réussi dont la relecture échoue RESTE réussi, et la relecture manquée se dit à part', async () => {
    const r = await gestePuisRelecture(async () => undefined, async () => Promise.reject(new Error('Réseau coupé')), message);
    expect(r).toEqual({ fait: true, erreurGeste: null, erreurRelecture: 'Réseau coupé' });
    expect(avisRelectureManquee('la liste des modes', 'Réseau coupé')).toMatch(/^Enregistré · la liste des modes n'a pas pu être relue \(Réseau coupé\)/);
  });

  it('tout réussi', async () => {
    expect(await gestePuisRelecture(async () => 1, async () => 2, message)).toEqual({ fait: true, erreurGeste: null, erreurRelecture: null });
  });
});

describe('câblage · les deux fenêtres passent par la règle', () => {
  for (const page of ['ModesReglementPage.tsx', 'ModelesImpressionPage.tsx']) {
    it(page, () => {
      const src = readFileSync(join(__dirname, '..', 'pages', page), 'utf8');
      expect(src).toMatch(/gestePuisRelecture\(/);
      expect(src).toMatch(/avisRelectureManquee\(/);
    });
  }
});
