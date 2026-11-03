import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * UN UTILITAIRE DE COULEUR DONT LE JETON N'EST PAS DÉCLARÉ NE PRODUIT AUCUN CSS.
 *
 * Tailwind 4 ne connaît que les couleurs du bloc `@theme` de index.css ; `text-accent`
 * ou `bg-success-soft` s'écrivent sans erreur, ne peignent rien, et l'élément
 * garde la couleur de son parent (onglet actif sans encre, message de succès
 * noir). La charte (§ 9 bis) n'admet d'ailleurs aucune couleur d'accent hors
 * de l'encre `sel` : le remède n'est jamais de déclarer le jeton manquant,
 * c'est d'employer celui qui existe (`sel`, `positive`, `positive-soft`).
 */
const racine = join(__dirname, '..');
const css = readFileSync(join(racine, 'index.css'), 'utf8');
const debut = css.indexOf('@theme {');
const theme = css.slice(debut, css.indexOf('\n}', debut));
const declares = new Set([...theme.matchAll(/--color-([\w-]+)\s*:/g)].map((m) => m[1]));

/** Les noms de couleur des bibliothèques d'interface habituelles, que ce thème ne déclare pas. */
const ABSENTS = [
  'accent',
  'success',
  'primary',
  'secondary',
  'muted',
  'foreground',
  'background',
  'destructive',
  'info',
  'card',
  'popover',
];
const PREFIXES = 'text|bg|border|ring|outline|fill|stroke|from|via|to|divide|decoration|caret|placeholder|shadow|accent';
const MOTIF = new RegExp(`(?:^|[\\s"'\`:!(])(?:${PREFIXES})-(${ABSENTS.join('|')})(?![\\w-]*[\\w])(?:/\\d+)?`, 'g');
const MOTIF_SUFFIXE = new RegExp(`(?:^|[\\s"'\`:!(])(?:${PREFIXES})-(${ABSENTS.join('|')})-[a-z]+`, 'g');

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom !== 'node_modules') fichiers(chemin, sortie);
    } else if (nom.endsWith('.tsx') && !nom.endsWith('.spec.tsx')) sortie.push(chemin);
  }
  return sortie;
}

describe('couleurs employées et couleurs déclarées', () => {
  it('le thème ne déclare aucune couleur d accent ni de succès', () => {
    for (const nom of ABSENTS) {
      expect(declares.has(nom), nom).toBe(false);
      expect(declares.has(`${nom}-soft`), `${nom}-soft`).toBe(false);
    }
    // Les jetons de remplacement existent bien.
    for (const nom of ['sel', 'sel-soft', 'positive', 'positive-soft']) expect(declares.has(nom), nom).toBe(true);
  });

  it('aucun écran n emploie un utilitaire de couleur sans jeton', () => {
    const fautes: string[] = [];
    for (const f of fichiers(racine)) {
      const lignes = readFileSync(f, 'utf8').split('\n');
      lignes.forEach((l, i) => {
        for (const m of [...l.matchAll(MOTIF), ...l.matchAll(MOTIF_SUFFIXE)]) {
          fautes.push(`${f.slice(racine.length + 1)}:${i + 1} ${m[0].trim()}`);
        }
      });
    }
    expect(fautes).toEqual([]);
  });

  it('le motif tombe sur ce qu il doit refuser et laisse les utilitaires natifs', () => {
    const refuse = (s: string) => [...s.matchAll(MOTIF), ...s.matchAll(MOTIF_SUFFIXE)].length > 0;
    for (const mauvais of [
      'className="text-accent"',
      'x hover:bg-accent/10',
      "`border-success/30 bg-success-soft`",
      'focus:ring-accent',
      'text-primary',
      'bg-destructive',
    ]) expect(refuse(mauvais), mauvais).toBe(true);
    for (const bon of [
      'text-sel',
      'bg-sel/10',
      'text-positive bg-positive-soft',
      'text-xs text-center text-white bg-black border-transparent text-current',
      'text-[11px] bg-surface border-border',
      'accent-color-non',
    ]) expect(refuse(bon), bon).toBe(false);
  });
});
