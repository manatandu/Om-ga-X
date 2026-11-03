import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * UN SURVOL ÉCRIT À LA MAIN SE GARDE PAR `(hover: hover) and (pointer: fine)`.
 *
 * Sur un écran tactile, `:hover` reste collé à l'élément touché jusqu'au toucher
 * suivant (mobile-native § 1) : une carte restait soulevée, une ligne teintée,
 * un bouton éclairci. Les variantes `hover:` de Tailwind 4 sont déjà gardées par
 * l'outil ; seules les règles écrites dans `index.css` le sont ici, à la main.
 * Le spec lit la STRUCTURE de la feuille (la pile des blocs qui enveloppent
 * chaque sélecteur), jamais une distance en lignes.
 *
 * Exceptions fermées : la barre de défilement (`::-webkit-scrollbar-thumb`,
 * inexistante au doigt), et la neutralisation sous mouvement réduit
 * (`transform: none`), qui retire un effet au lieu d'en poser un.
 */
const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const GARDE = /\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/;

interface Regle {
  selecteur: string;
  enveloppes: string[];
}

function regles(source: string): Regle[] {
  const sortie: Regle[] = [];
  const pile: string[] = [];
  let tete = '';
  for (const c of source) {
    if (c === '{') {
      pile.push(tete.trim());
      tete = '';
    } else if (c === '}') {
      const t = pile.pop();
      if (t !== undefined && !t.startsWith('@')) sortie.push({ selecteur: t, enveloppes: [...pile] });
      tete = '';
    } else if (c === ';') tete = '';
    else tete += c;
  }
  return sortie;
}

describe('le survol de la feuille de style', () => {
  const toutes = regles(css);
  const survols = toutes.filter((r) => r.selecteur.includes(':hover'));

  it('la feuille porte des survols, et le relevé les trouve', () => {
    expect(survols.length).toBeGreaterThan(8);
  });

  it('chaque règle :hover écrite à la main est gardée pour le pointeur fin', () => {
    const nues = survols
      .filter((r) => !r.enveloppes.some((e) => GARDE.test(e)))
      .filter((r) => !/::-webkit-scrollbar-thumb/.test(r.selecteur))
      .filter((r) => !r.enveloppes.some((e) => /prefers-reduced-motion/.test(e)))
      .map((r) => r.selecteur);
    expect(nues).toEqual([]);
  });

  it('le relevé reconnaît une règle nue', () => {
    const nue = regles('.a:hover{color:red}@media (hover: hover) and (pointer: fine){.b:hover{color:red}}');
    expect(nue.filter((r) => !r.enveloppes.some((e) => GARDE.test(e))).map((r) => r.selecteur)).toEqual(['.a:hover']);
  });
});
