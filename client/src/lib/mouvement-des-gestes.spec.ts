import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * LE MOUVEMENT NE SERT PAS LES GESTES DE CLAVIER NI LES GESTES RÉPÉTÉS.
 *
 * Norme 2 de review-animations (compétences d'Emil Kowalski) : ce que l'on fait
 * des dizaines de fois par jour, au clavier surtout, ne s'anime pas. Gelé ici,
 * ce que le code FAIT (structures de classes et d'appels), jamais une distance en
 * caractères (CLAUDE.md § 10) :
 *  · aucune transition sur `all`, ni sur `width` ou `height` (elles redessinent la
 *    mise en page) · on anime `transform`, `scale`, `opacity` ;
 *  · la liste de comptes de la saisie (frappe, F4) et la palette F7 s'ouvrent
 *    sans animation ;
 *  · un menu, ou un sous-menu, ne rejoue son entrée que s'il n'y en a pas déjà
 *    un d'ouvert ;
 *  · l'accueil écrit ses indicateurs d'emblée.
 * Les fenêtres (`fenetre-in`), la page publique et la règle du mouvement réduit
 * ne sont pas touchées.
 */
const racine = join(__dirname, '..');
const lire = (p: string) => readFileSync(join(racine, p), 'utf8');

function sources(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sources(chemin, sortie);
    else if (/\.tsx?$/.test(nom) && !/\.spec\.tsx?$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** Les chaînes de classes d'un fichier · `className="…"` et `className={`…`}`. */
const classes = (s: string) =>
  [...sansCommentaires(s).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2] ?? '');

describe('le mouvement des gestes très fréquents', () => {
  it('aucune transition sur all, width ou height', () => {
    const fautes: string[] = [];
    for (const f of sources(racine)) {
      for (const c of classes(readFileSync(f, 'utf8'))) {
        if (/\btransition-all\b|\btransition-\[(?:width|height)\b/.test(c)) fautes.push(`${f.slice(racine.length + 1)} · ${c.slice(0, 80)}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('la liste de comptes de la saisie n a aucune classe d animation', () => {
    const liste = classes(lire('pages/SaisiePage.tsx')).filter((c) => c.includes('w-[380px]') && c.includes('max-h-[240px]'));
    expect(liste.length).toBeGreaterThan(0);
    for (const c of liste) expect(c).not.toMatch(/\banim-/);
  });

  it('la palette Aller à une fonction s ouvre sans voile ni modale animés', () => {
    const toutes = classes(lire('components/chrome/AllerAFonction.tsx'));
    expect(toutes.length).toBeGreaterThan(0);
    for (const c of toutes) expect(c).not.toMatch(/\banim-/);
  });

  it('le menu et le sous-menu ne rejouent leur entrée qu à la première ouverture', () => {
    const src = sansCommentaires(lire('components/chrome/MenuBar.tsx'));
    // Toute occurrence de la classe est la branche « animer » d'une condition sur la référence.
    for (const [nom, ref] of [['anim-menu', 'sansAnimationMenu'], ['anim-sous-menu', 'sansAnimationSousMenu']] as const) {
      const occurrences = [...src.matchAll(new RegExp(`'${nom}'`, 'g'))].length;
      const gardees = [...src.matchAll(new RegExp(`${ref}\\.current \\? '' : '${nom}'`, 'g'))].length;
      expect(occurrences).toBeGreaterThan(0);
      expect(gardees).toBe(occurrences);
    }
    for (const c of classes(src)) expect(c).not.toMatch(/(^|\s)anim-(sous-)?menu(\s|$)/);
    // La décision se prend au geste (setter), pas au rendu : un rendu menu ouvert ne la défait pas.
    expect(src).toMatch(/const setOuvert = \(titre: string \| null\) => \{[\s\S]*?sansAnimationMenu\.current = /);
    expect(src).toMatch(/const setGroupeDeplie = \(titre: string \| null\) => \{[\s\S]*?sansAnimationSousMenu\.current = /);
  });

  it('l accueil écrit ses indicateurs d emblée', () => {
    const src = sansCommentaires(lire('pages/DashboardPage.tsx'));
    expect(src).not.toMatch(/useCompteur/);
    expect(src).toMatch(/function ValeurIndicateur[\s\S]*?montant\(valeur\)/);
  });

  it('l indicateur de la barre des fenêtres et la barre du démarrage guidé s animent par transform', () => {
    const barre = classes(lire('components/chrome/BarreFenetres.tsx')).join('\n');
    expect(barre).toMatch(/transition-\[scale,background-color\]/);
    expect(barre).not.toMatch(/\bw-1\.5\b/);
    const guide = classes(lire('components/DemarrageGuide.tsx')).join('\n');
    expect(guide).toMatch(/origin-left[^\n]*transition-transform/);
  });
});
