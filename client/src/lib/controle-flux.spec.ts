import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STYLE_CONTROLE_FLUX, issueDuControleDesFlux, motifDuControleNonEffectue } from './controle-flux';

/**
 * PAQUET 1, RELECTURE M1 · le contrôle du tableau des flux a trois issues.
 * Quand l'ouverture ou la variation est laissée vide, le serveur rend
 * `coherent: null` · l'écran l'écrivait « ÉCART DE -12 500 000,00 » en rouge,
 * un écart de toute la trésorerie chiffré sur des zéros. Les specs client ne
 * chargent pas React (`specs-sans-react.spec.ts`) · les pages se lisent sur
 * leur source.
 */
describe('contrôle du tableau des flux · trois issues', () => {
  it('null (ou absent) n’est ni un bouclage ni un écart', () => {
    expect(issueDuControleDesFlux(null)).toBe('NON_EFFECTUE');
    expect(issueDuControleDesFlux(undefined)).toBe('NON_EFFECTUE');
    expect(issueDuControleDesFlux(true)).toBe('BOUCLE');
    expect(issueDuControleDesFlux(false)).toBe('ECART');
  });

  it('un contrôle non effectué s’affiche en avertissement, jamais dans la couleur d’un écart', () => {
    expect(STYLE_CONTROLE_FLUX.NON_EFFECTUE.cadre).not.toBe(STYLE_CONTROLE_FLUX.ECART.cadre);
    expect(STYLE_CONTROLE_FLUX.NON_EFFECTUE.cadre).toContain('warning');
    expect(STYLE_CONTROLE_FLUX.ECART.cadre).toContain('danger');
  });

  it('le motif du serveur est dit tel quel, et une phrase sûre le remplace s’il manque', () => {
    expect(motifDuControleNonEffectue('Contrôle non effectué · ZA vide.')).toBe('Contrôle non effectué · ZA vide.');
    expect(motifDuControleNonEffectue(null)).toMatch(/^Contrôle non effectué/);
    expect(motifDuControleNonEffectue('  ')).toMatch(/^Contrôle non effectué/);
  });

  it('les deux écrans des flux et le rapport d’activité lisent l’issue par cette règle', () => {
    const lire = (page: string) => readFileSync(join(__dirname, '..', 'pages', page), 'utf8');
    for (const page of ['EtatsFinanciersPage.tsx', 'EtatsFinanciersSyscohadaPage.tsx']) {
      const source = lire(page);
      expect(source).toContain('issueDuControleDesFlux(tft.controle.coherent)');
      expect(source).toContain('motifDuControleNonEffectue(tft.controle.motifNonControlable)');
    }
    const documents = lire('DocumentsObligatoiresPage.tsx');
    expect(documents).toContain('issueDuControleDesFlux(confRap.tresorerie.boucle)');
    expect(documents).toContain('motifDuControleNonEffectue(confRap.tresorerie.motifNonControlable)');
  });
});
