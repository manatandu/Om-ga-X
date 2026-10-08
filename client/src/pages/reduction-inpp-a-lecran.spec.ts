import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PERSONNEL = readFileSync(join(__dirname, 'PersonnelPage.tsx'), 'utf8');
const RETENUES = readFileSync(join(__dirname, 'RetenuesPage.tsx'), 'utf8');

/**
 * ORDONNANCE n° 84/186 · la réduction du taux INPP se DÉCLARE (art. 1er,
 * al. 2), et l'INPP se paie par trimestre (art. 3). L'écran envoie, le
 * serveur juge · aucun plafond ni aucune échéance n'est recalculé ici.
 */
describe("Réduction du taux INPP à l'écran", () => {
  const corps = PERSONNEL.slice(PERSONNEL.indexOf('const corpsSimulation ='), PERSONNEL.indexOf('return corps;'));

  it('le corps de la simulation ne porte la réduction que si elle est saisie, avec son acte', () => {
    expect(corps).toMatch(/nombre\(reductionInpp\) !== undefined\s*\?\s*\{\s*reductionTauxInppPoints: nombre\(reductionInpp\)/);
    expect(corps).toContain('referenceReductionInpp: acteReductionInpp.trim()');
  });

  it('une réduction illisible se dit sous le champ, et chaque envoi qui porte le corps la refuse (mineur b)', () => {
    expect(PERSONNEL).toContain('const motifReductionInpp = motifReductionInppIllisible(reductionInpp);');
    expect(PERSONNEL).toMatch(/\{motifReductionInpp && \(\s*<span role="alert"/);
    for (const envoi of ['const simuler = ', 'const emettreBulletin = ', 'const proposerRetenues = ', 'const emettreDecompte = ']) {
      const debut = PERSONNEL.indexOf(envoi);
      expect(debut).toBeGreaterThan(-1);
      const corpsEnvoi = PERSONNEL.slice(debut, PERSONNEL.indexOf('api', debut));
      expect(corpsEnvoi).toContain('if (motifReductionInpp) return setErreur(motifReductionInpp);');
    }
  });

  it("le plafond du quart n'est pas recalculé côté client · le serveur le juge sur le taux du mois", () => {
    expect(corps).not.toMatch(/\/\s*4\b|\*\s*0[.,]25/);
  });

  it("la bulle d'aide nomme l'acte, le plafond et l'article", () => {
    const debut = PERSONNEL.indexOf('titre="Réduction du taux INPP"');
    expect(debut).toBeGreaterThan(-1);
    const bulle = PERSONNEL.slice(debut, PERSONNEL.indexOf('/>', debut));
    expect(bulle).toContain('le quart du taux');
    expect(bulle).toContain('Ordonnance n° 84/186 du 15 octobre 1984, art. 1er, al. 2');
  });
});

describe('Registre des retenues · la part INPP ou ONEM du mois est nommée', () => {
  it('une ligne par part, clé et libellé compris', () => {
    expect(RETENUES).toContain("key={`${m.mois}-${m.part ?? ''}`}");
    expect(RETENUES).toContain('LIBELLE_PART[m.part]');
  });

  it("la bulle de la colonne imputée sert la réserve d'imputation du SERVEUR, jamais un texte recopié", () => {
    const debut = RETENUES.indexOf('titre="Imputation des reversements"');
    expect(debut).toBeGreaterThan(-1);
    const bulle = RETENUES.slice(debut, RETENUES.indexOf('/>', debut));
    expect(bulle).toContain('texte={n.reserveImputation}');
    expect(bulle).toContain('Code civil, Livre III, art. 154, par analogie');
  });
});
