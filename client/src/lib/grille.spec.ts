import { ariaSort, comparerCellules, filtrerLignes, mentionTranche, trierLignes, triSuivant } from './grille';

interface L { n: string; m: number | null; i: string }
const lignes: L[] = [
  { n: '60110000', m: 500, i: 'Achats' },
  { n: '52110000', m: null, i: 'Banque' },
  { n: '41110000', m: 116000, i: 'Clients' },
  { n: '10000000', m: 500, i: 'Capital' },
];
const colonnes = { n: (l: L) => l.n, m: (l: L) => l.m, i: (l: L) => l.i };

describe('tri d’une grille, à l’écran seulement', () => {
  it('le cycle d’un en-tête · croissant, décroissant, puis l’ordre du serveur', () => {
    const a = triSuivant(null, 'm');
    expect(a).toEqual({ cle: 'm', sens: 'asc' });
    const b = triSuivant(a, 'm');
    expect(b).toEqual({ cle: 'm', sens: 'desc' });
    expect(triSuivant(b, 'm')).toBeNull();
    expect(triSuivant(b, 'n')).toEqual({ cle: 'n', sens: 'asc' });
  });

  it('aria-sort dit le sens de la seule colonne triée', () => {
    expect(ariaSort({ cle: 'm', sens: 'desc' }, 'm')).toBe('descending');
    expect(ariaSort({ cle: 'm', sens: 'asc' }, 'm')).toBe('ascending');
    expect(ariaSort({ cle: 'm', sens: 'asc' }, 'n')).toBe('none');
    expect(ariaSort(null, 'm')).toBe('none');
  });

  it('l’absence reste en dernier dans les DEUX sens, jamais lue comme zéro', () => {
    const asc = trierLignes(lignes, { cle: 'm', sens: 'asc' }, colonnes).map((l) => l.i);
    const desc = trierLignes(lignes, { cle: 'm', sens: 'desc' }, colonnes).map((l) => l.i);
    expect(asc).toEqual(['Achats', 'Capital', 'Clients', 'Banque']);
    expect(desc).toEqual(['Clients', 'Achats', 'Capital', 'Banque']);
  });

  it('le tri est stable et ne touche pas au tableau reçu', () => {
    const copie = [...lignes];
    const r = trierLignes(lignes, { cle: 'm', sens: 'asc' }, colonnes);
    expect(lignes).toEqual(copie);
    expect(r.indexOf(lignes[0])).toBeLessThan(r.indexOf(lignes[3])); // 500 · l’ordre d’origine tient
    expect(trierLignes(lignes, null, colonnes)).toBe(lignes);
  });

  it('les numéros de compte se classent à la française, « 2 » avant « 10 »', () => {
    expect(comparerCellules('2', '10')).toBeLessThan(0);
    expect(comparerCellules('Écart', 'ecran')).toBeLessThan(0);
  });
});

describe('filtre d’une grille', () => {
  const lire = (l: L) => [l.n, l.i, l.m];
  it('sans texte, rien n’est filtré', () => {
    expect(filtrerLignes(lignes, '  ', lire)).toBe(lignes);
  });
  it('accents et casse ignorés, nombres cherchés sans espaces', () => {
    expect(filtrerLignes(lignes, 'BANQ', lire).map((l) => l.i)).toEqual(['Banque']);
    expect(filtrerLignes(lignes, '116 000', lire).map((l) => l.i)).toEqual(['Clients']);
    expect(filtrerLignes(lignes, '5211', lire).map((l) => l.i)).toEqual(['Banque']);
  });
});

describe('une tranche ne se présente jamais comme le tout', () => {
  it('rien à dire quand la liste est entière', () => {
    expect(mentionTranche(50, 50, false)).toBeNull();
  });
  it('dit le nombre affiché et le total quand le serveur a tronqué', () => {
    const m = mentionTranche(2000, 12345, true)!;
    expect(m).toContain('2');
    expect(m).toContain('12');
    expect(m).toMatch(/non sur la liste entière/);
  });
  it('un total inconnu ne s’invente pas', () => {
    expect(mentionTranche(300, undefined, true)).not.toMatch(/ sur \d/);
  });
});
