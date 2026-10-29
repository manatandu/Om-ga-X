import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * LES CANAUX `--x-rgb` DISENT LA MÊME COULEUR QUE `--x`.
 *
 * Tailwind lit les couleurs de la charte en `rgb(var(--x-rgb))`
 * (bloc `@theme` de index.css), faute de pouvoir décomposer une variable. Le canal
 * est donc une COPIE en chiffres, et une copie diverge · un `--sel` changé
 * sans son canal peindrait tous les `bg-sel` de l'ancienne couleur et tous
 * les `text-sel` de la nouvelle, sans qu'aucun rendu ne casse.
 */
const racine = join(__dirname, '..', '..');
const css = readFileSync(join(racine, 'src', 'index.css'), 'utf8');
import { readdirSync, statSync } from 'node:fs';

/** Le bloc `@theme` de index.css, qui tient lieu de configuration en Tailwind 4. */
const theme = css.slice(css.indexOf('@theme {'), css.indexOf('\n}', css.indexOf('@theme {')));

/** Les déclarations du premier `:root` · `--nom: valeur;`. */
function variablesRacine(): Map<string, string> {
  const debut = css.indexOf(':root {');
  const corps = css.slice(debut, css.indexOf('\n}', debut)).replace(/\/\*[\s\S]*?\*\//g, '');
  const table = new Map<string, string>();
  for (const m of corps.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) table.set(m[1], m[2].trim());
  return table;
}

/** La valeur d'une variable, `var(--y)` suivi jusqu'à un code hexadécimal. */
function resoudre(table: Map<string, string>, nom: string): string {
  let v = table.get(nom);
  for (let pas = 0; v && pas < 8; pas++) {
    const renvoi = /^var\((--[\w-]+)\)$/.exec(v);
    if (!renvoi) break;
    v = table.get(renvoi[1]);
  }
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${nom} ne se résout pas en #rrggbb (${v})`);
  return v;
}

const couleurs = [...theme.matchAll(/--color-([\w-]+):/g)].map((m) => m[1]);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.tsx?$/.test(n) && !/\.(spec|test)\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('canaux des couleurs de la charte', () => {
  it('le recensement lit bien la liste de la configuration', () => {
    expect(couleurs).toEqual(expect.arrayContaining(['sel', 'danger', 'border', 'text-dim']));
  });

  it('chaque couleur a son canal, égal à sa valeur hexadécimale', () => {
    const table = variablesRacine();
    for (const nom of couleurs) {
      const hex = resoudre(table, `--${nom}`);
      const attendu = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
      expect({ nom, canal: table.get(`--${nom}-rgb`) }).toEqual({ nom, canal: attendu });
    }
  });

  it('les couleurs acceptent une opacité, le texte garde sa variable pleine', () => {
    // Le texte reste plein · une encre adoucie tomberait sous le plancher AA
    // de la charte (§ 7.4) sans que personne l'ait mesurée.
    for (const nom of couleurs) {
      expect(theme).toContain(`--color-${nom}: rgb(var(--${nom}-rgb));`);
      expect(theme).toContain(`--text-color-${nom}: var(--${nom});`);
    }
  });

  it("aucun écran n'adoucit une encre de la charte par une opacité", () => {
    const motif = new RegExp(`\\btext-(${couleurs.join('|')})/\\d+`, 'g');
    const fautes = fichiers(join(racine, 'src')).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(motif)].map((m) => `${f.slice(racine.length)} · ${m[0]}`),
    );
    expect(fautes).toEqual([]);
  });
});
