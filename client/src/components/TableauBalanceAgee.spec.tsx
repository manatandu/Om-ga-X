import { renderToStaticMarkup } from 'react-dom/server';
import { TableauBalanceAgee, type BalanceAgee } from './TableauBalanceAgee';

/**
 * PAQUET 1, B4 · LA BALANCE ÂGÉE SE LIT COMME UN TABLEAU.
 *
 * Avant (copie `main`) · la grille de `BalanceAgeePage.tsx` ne portait aucun
 * rôle (`role=` absent du fichier) · un lecteur d'écran lisait une suite de
 * montants sans en-tête de colonne ni de rangée. Le spec rend le tableau et
 * relit sa STRUCTURE (WAI-ARIA 1.2, motif « table ») · un tableau nommé, des
 * rangées dans des groupes de rangées, des cellules dans des rangées et
 * nulle part ailleurs, chaque rangée couvrant toutes les colonnes, les
 * en-têtes de colonne et de rangée là où ils se lisent.
 */

/** Un élément du rendu · balise, attributs, enfants, texte. */
interface Noeud {
  balise: string;
  attributs: Record<string, string>;
  enfants: Noeud[];
  texte: string;
}

/**
 * Le rendu statique de React, relu en arbre · balises ouvrantes, fermantes et
 * auto-fermantes, attributs entre guillemets doubles, texte. Le dépôt
 * n'embarque pas de DOM (`grilles-fixes-etroites.spec.ts`).
 */
function arbre(html: string): Noeud {
  const racine: Noeud = { balise: '#racine', attributs: {}, enfants: [], texte: '' };
  const pile: Noeud[] = [racine];
  const jeton = /<\/([a-z0-9]+)>|<([a-z0-9]+)((?:\s+[a-zA-Z-:]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = jeton.exec(html))) {
    if (m[1]) {
      const ferme = pile.pop()!;
      expect(ferme.balise).toBe(m[1]);
    } else if (m[2]) {
      const attributs: Record<string, string> = {};
      for (const a of m[3].matchAll(/([a-zA-Z-:]+)(?:="([^"]*)")?/g)) attributs[a[1]] = a[2] ?? '';
      const n: Noeud = { balise: m[2], attributs, enfants: [], texte: '' };
      pile[pile.length - 1].enfants.push(n);
      if (!m[4]) pile.push(n);
    } else if (m[5]) {
      for (const n of pile) n.texte += m[5];
    }
  }
  expect(pile).toHaveLength(1);
  return racine;
}

const tous = (n: Noeud): Noeud[] => [n, ...n.enfants.flatMap(tous)];
const role = (n: Noeud) => n.attributs.role;
const CELLULES = ['cell', 'columnheader', 'rowheader'];

const donnees: BalanceAgee = {
  dateReference: '2026-12-31',
  debutExercice: '2026-01-01',
  type: 'TOUS',
  tranches: [
    { cle: 'avant', libellePeriode: 'Avant le 01/01/2026', libelleAge: '+ 365 j' },
    { cle: 'reste', libellePeriode: 'Janvier à juillet', libelleAge: '+ 150 j' },
    { cle: '2026-12', libellePeriode: 'Décembre 2026', libelleAge: '0 à 30 j' },
  ],
  debiteurs: [{ cle: 't1', libelle: 'C1 - Client Un', codeTiers: 'C1', numero: '41110001', montants: [0, 1_000_000, 200_000], solde: 1_200_000 }],
  crediteurs: [{ cle: 't2', libelle: 'F1 - Fournisseur', codeTiers: 'F1', numero: '40110001', montants: [0, -300_000, 0], solde: -300_000 }],
  sensInverse: [{ cle: 't3', libelle: 'C2 - Avance', codeTiers: 'C2', numero: '41110002', montants: [], solde: -50_000 }],
  soldesNuls: [{ cle: 't4', libelle: 'C3 - Compensé', codeTiers: 'C3', numero: '41110003', montants: [], solde: 0 }],
  totaux: { parTranche: [0, 1_000_000, 200_000], parTrancheCrediteurs: [0, -300_000, 0], debiteurs: 1_200_000, crediteurs: -300_000, sensInverse: -50_000, net: 850_000 },
  lecture: 'Lecture du périmètre',
  libellePerimetre: 'Crédit commercial (40 et 41)',
};

describe('TableauBalanceAgee · la structure d’un tableau', () => {
  const racine = arbre(renderToStaticMarkup(<TableauBalanceAgee donnees={donnees} />));
  const elements = tous(racine);
  const tableaux = elements.filter((n) => role(n) === 'table');
  const rangees = elements.filter((n) => role(n) === 'row');
  const nbColonnes = donnees.tranches.length + 2;

  it('un tableau, nommé, qui dit son nombre de colonnes', () => {
    expect(tableaux).toHaveLength(1);
    expect(tableaux[0].attributs['aria-label']).toBe('Balance âgée · Crédit commercial (40 et 41)');
    expect(tableaux[0].attributs['aria-colcount']).toBe(String(nbColonnes));
  });

  it('ses enfants sont des groupes de rangées, et chaque rangée est dans un groupe', () => {
    expect(tableaux[0].enfants.every((n) => role(n) === 'rowgroup')).toBe(true);
    const dansLesGroupes = tableaux[0].enfants.flatMap((g) => g.enfants);
    expect(dansLesGroupes.every((n) => role(n) === 'row')).toBe(true);
    expect(dansLesGroupes).toHaveLength(rangees.length);
  });

  it('une rangée ne contient que des cellules, et couvre toutes les colonnes', () => {
    for (const r of rangees) {
      expect(r.enfants.every((c) => CELLULES.includes(role(c)))).toBe(true);
      const largeur = r.enfants.reduce((t, c) => t + Number(c.attributs['aria-colspan'] ?? 1), 0);
      expect(largeur).toBe(nbColonnes);
    }
  });

  it('aucune cellule hors d’une rangée', () => {
    const cellules = elements.filter((n) => CELLULES.includes(role(n)));
    const dansLesRangees = rangees.flatMap((r) => r.enfants);
    expect(cellules).toHaveLength(dansLesRangees.length);
  });

  it('les en-têtes de colonne · l’âge, puis le tiers, les périodes et le solde', () => {
    const [ages, periodes] = tableaux[0].enfants[0].enfants;
    expect(ages.enfants.map((c) => c.texte)).toEqual(['', '+ 365 j', '+ 150 j', '0 à 30 j', '']);
    expect(periodes.enfants.every((c) => role(c) === 'columnheader')).toBe(true);
    expect(periodes.enfants.map((c) => c.texte)).toEqual(['TIERS', 'Avant le 01/01/2026', 'Janvier à juillet', 'Décembre 2026', 'SOLDE']);
  });

  it('chaque tiers et chaque total est l’en-tête de sa rangée', () => {
    const entetes = rangees.flatMap((r) => r.enfants.filter((c) => role(c) === 'rowheader')).map((c) => c.texte);
    expect(entetes).toEqual([
      'C1 - Client Un',
      'Total débiteurs',
      'F1 - Fournisseur',
      'Total créditeurs',
      'C2 - Avance',
      'Total soldes en sens inverse',
      'C3 - Compensé',
      'Solde net',
    ]);
  });

  it('un intercalaire est une rangée d’une cellule qui couvre le tableau', () => {
    const intercalaires = rangees.filter((r) => r.enfants.length === 1);
    expect(intercalaires.map((r) => r.texte)).toEqual([
      'Soldes débiteurs',
      'Soldes créditeurs',
      'Soldes en sens inverse · non ventilés par antériorité',
      'Soldes nuls · pièces ouvertes qui se compensent',
    ]);
    for (const r of intercalaires) expect(r.enfants[0].attributs['aria-colspan']).toBe(String(nbColonnes));
  });

  it('sans aucune ligne · la rangée du message, et rien d’autre au corps', () => {
    const vide = arbre(
      renderToStaticMarkup(<TableauBalanceAgee donnees={{ ...donnees, debiteurs: [], crediteurs: [], sensInverse: [], soldesNuls: [] }} />),
    );
    const corps = tous(vide).filter((n) => role(n) === 'rowgroup')[1];
    expect(corps.enfants).toHaveLength(1);
    expect(corps.enfants[0].texte).toBe('Aucune échéance non lettrée sur les comptes de tiers de cet exercice.');
    expect(corps.enfants[0].enfants[0].attributs['aria-colspan']).toBe(String(nbColonnes));
  });
});
