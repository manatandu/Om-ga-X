import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Relevés de la ligne des cas chiffrés de l'IS (écran) · une clé de rendu
 * stable par ligne, « Retirer » nommé par sa ligne, et « Enregistrer
 * l'origine » éteint quand il n'y a rien à enregistrer. Les specs client ne
 * chargent pas React · le composant se lit sur sa source, par son CORPS.
 */
const source = readFileSync(join(__dirname, 'FiscalitePage.tsx'), 'utf8');
const corps = source.slice(source.indexOf('function OrigineDeficits('));

describe('origine des pertes reportées · écran', () => {
  it('chaque ligne a une clé stable, jamais son index', () => {
    expect(corps).toContain('key={l.cle}');
    expect(corps).not.toContain('key={i}');
  });

  it('« Retirer » se nomme par sa ligne', () => {
    expect(corps).toMatch(/aria-label=\{`Retirer l’exercice déficitaire/);
  });

  it('« Enregistrer l’origine » est éteint sans ligne ni origine à retirer', () => {
    expect(corps).toContain('const sansObjet = lignes.length === 0 && origines === null;');
    expect(corps).toMatch(/disabled=\{envoi \|\| !valides \|\| sansObjet\}/);
  });
});
