import { readFileSync } from 'fs';
import { join } from 'path';
// Aucun import de « vitest » (globales) · convention du dépôt, que le jest de la racine relit aussi.
import { TRADUCTIONS_EN, traduire, attributLang } from './traduction';

/**
 * LA LANGUE DU CADRE (ligne dossier-l9, fonction 96). Ce qui casserait en
 * silence · une commande nouvelle du menu sans son anglais s'afficherait en
 * français au milieu d'un menu anglais, sans qu'aucun écran ne le dise.
 */
const lire = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

/** Les libellés ÉCRITS du menu · `label: '…'` et `titre: '…'` d'AppShell, en chaîne littérale. */
function libellesDuMenu(source: string): string[] {
  const motif = /\b(?:label|titre):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  const vus = new Set<string>();
  for (const m of source.matchAll(motif)) vus.add((m[1] ?? m[2]).replace(/\\'/g, "'"));
  return [...vus];
}

describe('la langue du cadre', () => {
  it('chaque libellé écrit du menu a son anglais', () => {
    const libelles = libellesDuMenu(lire('components/chrome/AppShell.tsx'));
    // Le recensement trouve encore quelque chose · un motif périmé passerait tout.
    expect(libelles.length).toBeGreaterThan(100);
    expect(libelles.filter((l) => !(l in TRADUCTIONS_EN))).toEqual([]);
  });

  it("sans traduction, le français · jamais vide ; en français, le texte tel qu'il est", () => {
    expect(traduire('Plan comptable', 'EN')).toBe('Chart of accounts');
    expect(traduire('Une commande inconnue', 'EN')).toBe('Une commande inconnue');
    expect(traduire('Plan comptable', 'FR')).toBe('Plan comptable');
    expect(attributLang('EN')).toBe('en');
    expect(attributLang('FR')).toBe('fr');
  });

  it('aucune traduction vide, aucune clé en double sous deux formes', () => {
    for (const [fr, en] of Object.entries(TRADUCTIONS_EN)) {
      expect([fr, en.trim().length > 0]).toEqual([fr, true]);
    }
  });

  it('le cadre traduit au RENDU · la barre de menus, les boutons des fenêtres, la barre d’état', () => {
    expect(lire('components/chrome/MenuBar.tsx')).toMatch(/\{tr\(item\.label\)\}/);
    expect(lire('components/chrome/MenuBar.tsx')).toMatch(/\{tr\(m\.titre\)\}/);
    expect(lire('components/chrome/Fenetre.tsx')).toMatch(/title=\{tr\(titre\)\}/);
    expect(lire('components/chrome/StatusBar.tsx')).toMatch(/tr\('Accueil'\)/);
  });

  it("l'anglais ne s'applique que si le serveur le PROPOSE · le contrat dit le français seul", () => {
    expect(lire('lib/langue.tsx')).toMatch(/p\.languesProposees\.includes\('EN'\)/);
    expect(lire('pages/PreferencesPage.tsx')).toMatch(/prefs\.languesProposees\.length > 1/);
  });
});
