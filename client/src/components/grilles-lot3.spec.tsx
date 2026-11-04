import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TableauBalanceAgee, type BalanceAgee } from './TableauBalanceAgee';
import { BoutonTri, FiltreGrille, attributsEntete } from './GrilleOutils';

/**
 * LOT 3 DU DESIGN · grilles. Comportement rendu (SSR) et STRUCTURE de source ·
 * le dépôt n'embarque pas de DOM, le parcours au clavier est éprouvé au
 * navigateur (`e2e/tests/clavier-grilles.e2e.ts`).
 */
const donnees: BalanceAgee = {
  dateReference: '2026-12-31',
  debutExercice: '2026-01-01',
  type: 'TOUS',
  tranches: [{ cle: 'a', libellePeriode: 'Avant', libelleAge: '+ 365 j' }],
  debiteurs: [
    { cle: 't1', libelle: 'C1 - Zéphyr', codeTiers: 'C1', numero: '41110001', montants: [10], solde: 10 },
    { cle: 't2', libelle: 'C2 - Alpha', codeTiers: 'C2', numero: '41110002', montants: [99], solde: 99 },
  ],
  crediteurs: [],
  sensInverse: [],
  soldesNuls: [],
  totaux: { parTranche: [109], parTrancheCrediteurs: [0], debiteurs: 109, crediteurs: 0, sensInverse: 0, net: 109 },
  lecture: '',
  libellePerimetre: 'Crédit commercial',
};

describe('en-têtes triables', () => {
  it('chaque colonne de la balance âgée porte aria-sort et un bouton, la colonne non triée « none »', () => {
    const html = renderToStaticMarkup(<TableauBalanceAgee donnees={donnees} />);
    expect(html.match(/role="columnheader"[^>]*aria-sort="none"/g)?.length).toBe(3); // tiers, période, solde
    expect(html.match(/<button[^>]*class="bouton-tri"/g)?.length).toBe(3);
    expect(html).not.toContain('aria-sort="ascending"');
  });

  it('un en-tête non trié n’affiche aucun indicateur (dessin d’avant)', () => {
    const html = renderToStaticMarkup(<BoutonTri cle="x" tri={null} onTri={() => {}}>Débit</BoutonTri>);
    expect(html).not.toContain('marque-tri');
    expect(html).toContain('Cliquer pour trier');
  });

  it('la colonne triée porte l’indicateur et le sens dans aria-sort', () => {
    const tri = { cle: 'x', sens: 'desc' as const };
    expect(renderToStaticMarkup(<BoutonTri cle="x" tri={tri} onTri={() => {}}>Débit</BoutonTri>)).toContain('marque-tri');
    expect(attributsEntete(tri, 'x')['aria-sort']).toBe('descending');
  });

  it('le filtre de la balance âgée écarte les tiers sans toucher aux totaux', () => {
    const html = renderToStaticMarkup(<TableauBalanceAgee donnees={donnees} filtre="alpha" />);
    expect(html).toContain('C2 - Alpha');
    expect(html).not.toContain('Zéphyr');
    // Total débiteurs de la balance ENTIÈRE (109), pas de la ligne filtrée (99).
    expect(html).toContain('109,00');
    expect(renderToStaticMarkup(<TableauBalanceAgee donnees={donnees} filtre="introuvable" />)).toContain('Aucun tiers ne correspond au filtre.');
  });
});

describe('filtre d’une grille et tranche', () => {
  it('rien à dire sans filtre ni troncature', () => {
    const html = renderToStaticMarkup(<FiltreGrille valeur="" onChange={() => {}} etiquette="Filtrer" lues={50} montrees={50} />);
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('non sur la liste entière');
  });
  it('avec un filtre, dit combien de lignes sur combien de lues', () => {
    const html = renderToStaticMarkup(<FiltreGrille valeur="ban" onChange={() => {}} etiquette="Filtrer" lues={50} montrees={3} />);
    expect(html).toContain('3 lignes sur 50 lues');
  });
  it('sur une liste tronquée, le dit : tri et filtre ne portent que sur la tranche', () => {
    const html = renderToStaticMarkup(
      <FiltreGrille valeur="" onChange={() => {}} etiquette="Filtrer" lues={2000} montrees={2000} total={12345} tronque />,
    );
    expect(html).toContain('non sur la liste entière');
    expect(html).toContain('12');
  });
});

describe('pages · rôles, en-têtes figés, clavier', () => {
  const page = (f: string) => readFileSync(join(__dirname, '..', 'pages', f), 'utf8');

  it('le journal est un tableau à en-tête figé, ses lignes des rangées, et ne se trie pas (pièces groupées)', () => {
    const src = page('JournalPage.tsx');
    expect(src).toMatch(/role="table"\s+aria-label="Journal des écritures"/);
    expect(src).toMatch(/role="row" className="entete-colonnes entete-fixe grid/);
    expect(src).toMatch(/key=\{l\.key\}\s+role="row"/);
  });

  it('la balance est triable, filtrable, à en-tête et pied figés, et sa ligne s’ouvre à Entrée', () => {
    const src = page('JournalPage.tsx');
    expect(src).toContain('aria-label="Balance des comptes"');
    expect(src).toContain('<div role="rowgroup" className="entete-fixe">');
    expect(src).toContain('pied-fixe grid ${GRILLE_BALANCE}');
    expect(src).toMatch(/role="row"\s*\/\/[^\n]*\n[^\n]*\n[^\n]*\n\s*tabIndex=\{l\.regroupe \? undefined : 0\}/);
    expect(src).toMatch(/e\.key === 'Enter' && e\.target === e\.currentTarget/);
    // Le double-clic reste.
    expect(src).toContain('onDoubleClick={l.regroupe ? undefined : () => ouvrirGrandLivreDe(l)}');
  });

  it('« aucun compte ne correspond au filtre » ne se dit que d\u2019une balance lue, non vide, et filtrée', () => {
    const src = page('JournalPage.tsx');
    expect(src).toContain("balance.length > 0 && balanceAffichee?.length === 0 && filtreBalance.trim() !== ''");
  });

  it('les totaux de la balance restent ceux de la balance entière, filtre ou non', () => {
    const src = page('JournalPage.tsx');
    expect(src).toContain('(balance ?? []).reduce((s, l) => s + f(l), 0)');
    expect(src).toContain('(balance ?? []).reduce((t, l) => t + f(l), 0)');
  });

  it('le grand livre garde sa chronologie : un tableau par compte, en-têtes figés, aucun tri', () => {
    const src = page('JournalPage.tsx');
    expect(src).toContain('aria-label={`Grand livre du compte');
    expect(src).toMatch(/role="row" style=\{\{ top: '1\.625rem' \}\} className=\{`entete-fixe grid \$\{GRILLE_GL\}/);
    expect(src).toContain('sticky top-0 z-[3] h-[1.625rem]');
    expect(src).not.toMatch(/BoutonTri cle="date"/);
  });

  it('la balance auxiliaire s’ouvre au clavier comme au double-clic', () => {
    const src = page('BalanceAuxiliairePage.tsx');
    expect(src).toMatch(/tabIndex=\{0\}/);
    expect(src).toMatch(/e\.key === 'Enter' && e\.target === e\.currentTarget/);
    expect(src).toContain('onDoubleClick={() => navigate(adresseGrandLivreDuCompte(c.compteId))}');
  });

  it('le plan comptable est une grille : lignes atteignables, choix à Entrée ou Espace, tri en tête', () => {
    const src = page('PlanComptesPage.tsx');
    expect(src).toContain('role="grid"');
    expect(src).toMatch(/role="row"\s+data-compte-id=\{c\.id\}\s+tabIndex=\{c\.id === idLigneActive \? 0 : -1\}\s+aria-selected=\{selectionId === c\.id\}/);
    expect(src).toContain("e.key === 'ArrowDown'");
    expect(src).toContain("e.key === 'End'");
    expect(src).toMatch(/e\.key === 'Enter' \|\| e\.key === ' '/);
    expect(src).toContain("onDoubleClick={() => c.typeCompte === 'DETAIL' && navigate(");
  });

  it('M1 · le cadre d’une grille est borné par la fenêtre (colonne flex), jamais par l’écran', () => {
    const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');
    const bloc = css.slice(css.indexOf('.grille-longue {'), css.indexOf('.entete-fixe {'));
    expect(bloc).not.toMatch(/dvh|\bvh\b/);
    expect(bloc).toContain('flex: 0 1 auto');
    for (const f of ['JournalPage.tsx', 'BalanceAgeePage.tsx', 'BalanceAuxiliairePage.tsx']) {
      expect(page(f), f).toContain('<div className="p-2 page-a-grille">');
    }
  });

  it('M2 · sous filtre, les totaux de la balance âgée et de la balance sur téléphone se disent « balance entière »', () => {
    const tableau = readFileSync(join(__dirname, 'TableauBalanceAgee.tsx'), 'utf8');
    expect(tableau.match(/\(balance entière\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(page('BalanceAgeePage.tsx')).toContain('Ces groupes sont ceux de la balance entière, non filtrés.');
    expect(page('BalanceAgeePage.tsx')).not.toMatch(/lues=\{[^}]*soldesNuls/);
    expect(page('JournalPage.tsx')).toContain('balanceEntiere={filtreBalance.trim() !== \'\'}');
    const cartes = readFileSync(join(__dirname, 'CartesComptables.tsx'), 'utf8');
    expect(cartes).toContain("balanceEntiere ? ' (balance entière)' : ''");
    expect(page('JournalPage.tsx')).toMatch(/lignes\.length === 0 && filtreBalance\.trim\(\) !== ''/);
  });

  it('M3, M4 · plan comptable à tabulation itinérante, six cellules par ligne', () => {
    const src = page('PlanComptesPage.tsx');
    // Un seul arrêt de tabulation : tabIndex 0 pour la ligne active seule.
    expect(src.match(/tabIndex=\{/g)?.length).toBe(1);
    const ligne = src.slice(src.indexOf('data-compte-id={c.id}'), src.indexOf('{c.typeCompte !== \'DETAIL\' ? \'\' : c.subdivise'));
    expect(ligne.match(/role="gridcell"/g)?.length).toBe(6);
    expect(src).toContain('aria-colcount={6}');
  });

  it('m3 · tri et filtre repartent à zéro avec la lecture', () => {
    expect(page('JournalPage.tsx')).toMatch(/setTriBalance\(null\);\s*setFiltreBalance\(''\);\s*\}, \[cleBalance\]\)/);
    expect(page('BalanceAgeePage.tsx')).toContain('}, [exerciceCourant?.id, dateReference, type]);');
    expect(page('BalanceAgeePage.tsx')).toContain("cles.has(triBrut.cle) ? triBrut : null");
    expect(page('BalanceAuxiliairePage.tsx')).toContain('}, [exerciceCourant?.id, type]);');
    expect(page('PlanComptesPage.tsx')).toContain('}, [idDossier]);');
  });

  it('m7 · un seul pied figé par grille (jamais deux sticky bas superposés)', () => {
    expect(page('BalanceAuxiliairePage.tsx')).toContain('<div role="rowgroup" className="pied-fixe">');
    const tableau = readFileSync(join(__dirname, 'TableauBalanceAgee.tsx'), 'utf8');
    expect(tableau.match(/pied-fixe/g)?.length).toBe(1);
  });
});
