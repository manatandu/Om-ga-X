import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LOT 3 DU DESIGN · L'ANNEAU DE FOCUS EST À L'ENCRE DE LA CHARTE, MESURÉ.
 * Il était noir (`var(--text)`) : hors charte. Il est maintenant `var(--sel)`
 * (l'encre, sans couleur d'accent), blanc sur le bandeau et sur les fonds pleins,
 * et son contraste NON TEXTUEL (WCAG 1.4.11, 3:1) est calculé ici sur les jetons.
 */
const css = readFileSync(join(__dirname, 'index.css'), 'utf8');

function jeton(nom: string): string {
  const m = new RegExp(`${nom.replace(/[-]/g, '\\-')}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`jeton ${nom} introuvable`);
  return m[1];
}
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('focus visible', () => {
  it('l’anneau des boutons, liens et lignes est à l’encre (--sel), plus noir', () => {
    expect(css).toMatch(/button:focus-visible,\s*a:focus-visible \{\s*outline: 2px solid var\(--sel\);/);
    expect(css).toMatch(/summary:focus-visible \{\s*outline: 2px solid var\(--sel\);/);
    expect(css).not.toMatch(/outline: 2px solid var\(--text\)/);
  });

  it('l’encre fait au moins 3:1 sur chaque fond où l’anneau se pose', () => {
    const sel = jeton('--a-600'); // --sel: var(--a-600)
    expect(css).toMatch(/--sel: var\(--a-600\);/);
    for (const fond of ['--bg', '--fenetre']) expect(contraste(sel, jeton(fond))).toBeGreaterThanOrEqual(3);
    expect(contraste(sel, '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('sur le bandeau d’encre et les fonds pleins, l’anneau est blanc, et le blanc y fait au moins 3:1', () => {
    expect(css).toMatch(/\.bg-\\\(--bandeau\\\) :is\(button, a, \[role='button'\]\):focus-visible \{\s*outline-color: #ffffff;/);
    expect(css).toMatch(/\[role='row'\]\[aria-selected='true'\]:focus-visible \{\s*outline-color: #ffffff;/);
    expect(contraste('#ffffff', jeton('--a-900'))).toBeGreaterThanOrEqual(3);
    expect(contraste('#ffffff', jeton('--a-700'))).toBeGreaterThanOrEqual(3); // en-tête plein des grilles
  });

  it('les lignes atteignables au clavier (role=row + tabindex) ont leur anneau', () => {
    expect(css).toMatch(/\[role='row'\]\[tabindex\]:focus-visible/);
  });
});
