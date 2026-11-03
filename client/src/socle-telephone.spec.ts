import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// AUCUN import de « vitest », comme chrome-etroit.spec.ts · describe/it/expect
// arrivent par les globales, ce qui rend le fichier exécutable par les DEUX
// lanceurs (le jest de la racine ramasse aussi client/src).

/**
 * LE SOCLE TÉLÉPHONE (reprise du design, lot 2, 2026-11-03).
 *
 * Aucun de ces défauts ne lève d'erreur ni ne se voit au bureau : une barre
 * d'état sous la barre d'URL, un champ qui fait zoomer iOS, une fenêtre que le
 * doigt pousse hors de l'écran. jsdom ne calcule aucune mise en page, on gèle
 * donc la CAUSE dans la source, ancrée sur une STRUCTURE (une classe, une
 * règle, un appel), jamais sur une distance en caractères (CLAUDE.md § 10). Les
 * mesures au navigateur (cibles, débordement, pixels du bureau) sont rejouées
 * à la main et dites dans AVANCEMENT-design-lot2.md.
 */
const lire = (chemin: string) => readFileSync(join(__dirname, chemin), 'utf8');
const sansCommentaires = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Le corps d'un bloc `{ … }` qui s'ouvre à `debut`, accolades équilibrées. */
function bloc(css: string, debut: string): string {
  const i = css.indexOf(debut);
  expect(i).toBeGreaterThanOrEqual(0);
  let profondeur = 0;
  for (let k = css.indexOf('{', i); k < css.length; k++) {
    if (css[k] === '{') profondeur++;
    if (css[k] === '}' && --profondeur === 0) return css.slice(css.indexOf('{', i) + 1, k);
  }
  throw new Error(`bloc non refermé : ${debut}`);
}

describe('le cadre suit la hauteur VISIBLE du téléphone', () => {
  it("aucun conteneur d'écran n'est en 100vh (`h-screen`, `min-h-screen`)", () => {
    for (const f of [
      'components/chrome/AppShell.tsx',
      'App.tsx',
      'pages/AuthPage.tsx',
      'pages/EssaiPage.tsx',
      'pages/InvitationPage.tsx',
      'pages/ChoixDossierPage.tsx',
      'pages/ChangerMotDePassePage.tsx',
      'pages/RegisterPage.tsx',
    ]) {
      // Les classes seulement · les commentaires disent l'ancien nom pour l'expliquer.
      expect(sansCommentaires(lire(f))).not.toMatch(/\b(min-)?h-screen\b/);
    }
  });

  it("l'application est en `h-dvh`, les portes d'ouverture en `min-h-svh`", () => {
    expect(lire('components/chrome/AppShell.tsx')).toMatch(/className="cadre-sur h-dvh flex flex-col/);
    expect(lire('pages/AuthPage.tsx')).toMatch(/min-h-svh/);
  });

  it('la borne des modales garde `vh` PUIS `dvh` (navigateurs sans dvh)', () => {
    const regle = bloc(lire('index.css'), '.modale-bornee');
    expect(regle.indexOf('100vh')).toBeGreaterThanOrEqual(0);
    expect(regle.indexOf('100vh')).toBeLessThan(regle.indexOf('100dvh'));
  });
});

describe('la méta viewport', () => {
  const html = lire('../index.html');
  const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/)?.[1] ?? '';

  it('peint sous l\'encoche et laisse le clavier réduire la mise en page', () => {
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).toContain('interactive-widget=resizes-content');
  });

  it("n'interdit JAMAIS le zoom (échec d'accessibilité)", () => {
    expect(viewport).not.toMatch(/user-scalable|maximum-scale/);
  });

  it("un seul theme-color · l'interface n'a pas de thème sombre", () => {
    expect(html.match(/name="theme-color"/g)).toHaveLength(1);
    expect(lire('index.css')).not.toMatch(/prefers-color-scheme/);
  });
});

describe('les règles du pointeur grossier (index.css)', () => {
  const css = lire('index.css');
  const grossier = bloc(css, '@media (pointer: coarse) {');

  it('champs à 16 px SOUS le pointeur grossier seulement · le bureau reste à 12 px', () => {
    expect(grossier).toMatch(/input,\s*select,\s*textarea\s*\{\s*font-size:\s*16px;/);
    // Hors du bloc, aucune règle ne fixe les champs à 16 px · le corps reste à 12 px.
    expect(css.replace(grossier, '')).not.toMatch(/input,\s*select,\s*textarea\s*\{\s*font-size:\s*16px/);
    expect(bloc(css, '  body {')).toMatch(/font-size:\s*12px;/);
  });

  it('zone de toucher de 44 px · pseudo-élément pour les petits contrôles, taille pour les boutons et boîtes', () => {
    expect(grossier).toMatch(/\.cible-44::after\s*\{[^}]*width:\s*max\(100%,\s*44px\)[^}]*height:\s*max\(100%,\s*44px\)/);
    expect(grossier).toMatch(/\.btn\s*\{\s*min-height:\s*44px;/);
    expect(grossier).toMatch(/\[role='dialog'\] button/);
  });

  it('les gestes du navigateur · pas de surbrillance, pas de rebond de page, pas de double-toucher', () => {
    expect(css).toMatch(/html\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent/);
    expect(css).toMatch(/html,\s*body\s*\{\s*overscroll-behavior:\s*none;/);
    expect(css).toMatch(/summary\s*\{\s*touch-action:\s*manipulation;/);
  });

  it('les zones sûres bordent les barres, sans pixel de plus quand il n\'y a pas d\'encoche', () => {
    expect(css).toMatch(/padding-left:\s*env\(safe-area-inset-left,\s*0px\)/);
    expect(bloc(css, '.barre-sur-haut {')).toContain('env(safe-area-inset-top, 0px)');
    expect(bloc(css, '.barre-sur-bas {')).toContain('env(safe-area-inset-bottom, 0px)');
    // La hauteur s'AJOUTE (border-box) · un `content-box` ajouterait la bordure à 24 px.
    expect(bloc(css, '.barre-sur-bas {')).toMatch(/height:\s*calc\(24px \+/);
    expect(lire('components/chrome/StatusBar.tsx')).toContain('barre-sur-bas');
    expect(lire('components/chrome/AppShell.tsx')).toContain('barre-sur-haut');
  });

  it("les conteneurs défilants ne chaînent au parent qu'au doigt (le bureau garde son rendu)", () => {
    for (const f of ['components/chrome/Fenetre.tsx', 'components/chrome/AppShell.tsx', 'pages/AccueilPage.tsx']) {
      expect(lire(f)).toMatch(/pointer-coarse:overscroll-contain/);
      expect(lire(f)).not.toMatch(/[^:]overscroll-contain/);
    }
  });

  it('les petits contrôles du chrome portent la zone de toucher', () => {
    expect(lire('components/chrome/Aide.tsx')).toMatch(/cible-44 relative inline-flex/);
    expect(lire('components/chrome/OutilsChrome.tsx').match(/cible-44 relative/g)?.length).toBeGreaterThanOrEqual(3);
    expect(lire('components/chrome/BarreFenetres.tsx')).toMatch(/cible-44 relative mr-1/);
  });
});

describe('la seule borne de 640 px', () => {
  it('`useSous640` est la négation du `min-width: 640px` de la barre de menus', () => {
    expect(lire('lib/media.ts')).toContain("'not all and (min-width: 640px)'");
    expect(lire('components/chrome/MenuBar.tsx')).toContain("useMedia('(min-width: 640px)')");
  });
});

describe('sous 640 px, les fenêtres sont le plein écran de la zone de travail', () => {
  const src = lire('components/chrome/Fenetre.tsx');

  it('le style rendu devient `inset: 0`, sans toucher à la géométrie mémorisée', () => {
    expect(src).toContain('const telephone = useSous640();');
    expect(src).toMatch(/const style: React\.CSSProperties = telephone\s*\?\s*\{ inset: 0, zIndex: fenetre\.ordre \}/);
    // Le mode ne ré-écrit jamais le cadre : retour au-dessus de 640 px = géométrie d'avant.
    expect(src.slice(src.indexOf('const style: React.CSSProperties'), src.indexOf('return (', src.indexOf('const style: React.CSSProperties')))).not.toMatch(/deplacer\(/);
  });

  it('ni déplacement, ni poignées, ni agrandir/restaurer', () => {
    expect(src).toMatch(/if \(telephone\) return;[^\n]*\n/);
    expect(src).toMatch(/\{!agrandie && !telephone &&\s*POIGNEES\.map/);
    expect(src).toMatch(/\{!telephone && \(\s*<BoutonTitre[\s\S]*?titre=\{agrandie \? 'Restaurer' : 'Agrandir'\}/);
    expect(src).toMatch(/onDoubleClick=\{telephone \? undefined/);
    // Les poignées sont aussi cachées par la classe sous 640 px (coin bas droit compris).
    const poignees = src.slice(src.indexOf('const POIGNEES'), src.indexOf('];', src.indexOf('const POIGNEES')));
    expect(poignees.match(/hidden sm:block/g)).toHaveLength(8);
  });

  it('réduire et fermer restent', () => {
    expect(src).toMatch(/titre="Réduire"/);
    expect(src).toMatch(/titre="Fermer"/);
  });
});

describe('sous 640 px, les menus passent derrière « ☰ »', () => {
  const src = lire('components/chrome/MenuBar.tsx');

  it('bouton nommé, déplié/replié, relié à son panneau', () => {
    expect(src).toMatch(/aria-label="Menus"/);
    expect(src).toMatch(/aria-expanded=\{burger\}/);
    expect(src).toMatch(/aria-controls="panneau-des-menus"/);
    expect(src).toMatch(/id="panneau-des-menus"/);
  });

  it('même contenu · le panneau reprend `menus` et le repli existant', () => {
    expect(src).toMatch(/\{!volant && \(/);
    expect(src).toMatch(/\{rendreReplie\(m\.items\)\}/);
  });

  it('Échap referme et rend le focus au bouton', () => {
    expect(src).toMatch(/if \(etaitLePanneau\) refBurger\.current\?\.focus\(\);/);
  });

  it('la déconnexion garde son nom en icône, le nom du dossier se tronque avec son infobulle', () => {
    const shell = lire('components/chrome/AppShell.tsx');
    expect(shell).toMatch(/aria-label="Déconnexion"/);
    expect(shell).toMatch(/<span className="truncate text-white" title=\{utilisateur\?\.tenant\.nom\}>/);
  });

  it("la barre verticale de l'accueil se replie derrière un bouton, fermé au départ", () => {
    const accueil = lire('pages/AccueilPage.tsx');
    expect(accueil).toContain('const [barreOuverte, setBarreOuverte] = useState(false);');
    expect(accueil).toMatch(/aria-controls="barre-verticale"/);
    expect(accueil).toMatch(/barreOuverte \? 'max-sm:max-h-\[60dvh\]' : 'max-sm:hidden'/);
  });
});

describe('journal, grand livre et balance ont leur carte sous 640 px', () => {
  const page = lire('pages/JournalPage.tsx');

  it('une SEULE présentation dans le DOM · grille au bureau, cartes au téléphone', () => {
    expect(page).toContain('const telephone = useSous640();');
    expect(page).toMatch(/\{onglet === 'journal' && !telephone && \(/);
    expect(page).toMatch(/\{onglet === 'journal' && telephone && \(/);
    expect(page).toMatch(/\{onglet === 'balance' && !telephone && \(/);
    expect(page).toMatch(/\{onglet === 'balance' && telephone && \(/);
    expect(page).toMatch(/\{!telephone \? \(\s*<>/);
    expect(page).toContain('<CarteLigneGrandLivre');
  });

  it("aucune action perdue · le double-clic de la balance a son bouton, l'état du journal les mêmes badges", () => {
    // Le double-clic et le bouton « Grand livre » appellent LA MÊME fonction.
    expect(page).toMatch(/onDoubleClick=\{l\.regroupe \? undefined : \(\) => ouvrirGrandLivreDe\(l\)\}/);
    expect(page).toMatch(/onGrandLivre=\{l\.regroupe \? undefined : \(\) => ouvrirGrandLivreDe\(l\)\}/);
    // L'état d'une pièce (brouillard, correction, revue) est écrit une fois.
    expect(page.match(/\{badgesLigne\(l\)\}/g)).toHaveLength(2);
    expect(page).toMatch(/setFicheOuverte\(l\.ecritureId\)/);
  });

  it('les cartes gardent les montants en une ligne (jamais coupés)', () => {
    const cartes = lire('components/CartesComptables.tsx');
    expect(cartes).toMatch(/font-mono text-\[11px\] tabular-nums whitespace-nowrap/);
    expect(cartes).toMatch(/grid grid-cols-2/);
  });
});

describe('la porte de connexion', () => {
  const auth = lire('pages/AuthPage.tsx');

  it("pas de focus d'office au doigt (il ouvre le clavier)", () => {
    expect(auth).toContain("const auDoigt = useMedia('(pointer: coarse)');");
    expect(auth).toContain('autoFocus={!auDoigt && !email}');
    expect(auth).toContain('autoFocus={!auDoigt && Boolean(email)}');
  });

  it('les gestionnaires de mots de passe reconnaissent les champs', () => {
    expect(auth).toContain('autoComplete="username"');
    expect(auth).toContain('autoComplete="current-password"');
  });

  it("l'œil est nommé et atteignable au clavier", () => {
    const oeil = auth.slice(auth.indexOf('setMotDePasseVisible((v) => !v)') - 80, auth.indexOf('<IconOeil'));
    expect(oeil).toMatch(/aria-label=\{motDePasseVisible \?/);
    expect(oeil).not.toMatch(/tabIndex=\{-1\}/);
  });
});
