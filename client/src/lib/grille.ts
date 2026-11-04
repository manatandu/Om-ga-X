/**
 * TRI ET FILTRE D'UNE GRILLE, À L'ÉCRAN SEULEMENT (lot 3 du design, 2026-11-03).
 *
 * Ce module ne parle pas au serveur : il range et filtre les lignes DÉJÀ LUES.
 * C'est une règle de vérité avant d'être une règle d'ergonomie · une liste que
 * le serveur a tronquée (`tronque`, `total`) n'est qu'une tranche, et un tri
 * ou un filtre sur une tranche ne dit rien du tout. Un classement « du plus
 * grand au plus petit » présenté comme celui du livre entier ferait lire le
 * plus gros mouvement de la tranche comme le plus gros du dossier. La phrase
 * qui le dit vient donc d'ici (`mentionTranche`), pour que chaque écran la
 * dise pareil.
 *
 * Le tri est STABLE (deux lignes égales gardent l'ordre où le serveur les a
 * rendues) et il ne touche jamais au tableau reçu.
 */

import { montant } from './montants';

export type SensTri = 'asc' | 'desc';
export interface EtatTri {
  cle: string;
  sens: SensTri;
}

/** Valeur qu'une colonne sait donner d'une ligne · nombre, texte ou absence. */
export type Cellule = number | string | null | undefined;

const COLLATEUR = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/**
 * Comparaison de deux cellules · les nombres entre eux par valeur, les textes
 * à la française (accents et casse ignorés, « 2 » avant « 10 »), l'ABSENCE
 * toujours en dernier quel que soit le sens, jamais lue comme un zéro.
 */
function estVide(c: Cellule): boolean {
  return c === null || c === undefined || c === '';
}

export function comparerCellules(a: Cellule, b: Cellule): number {
  const aVide = estVide(a);
  const bVide = estVide(b);
  if (aVide || bVide) return aVide === bVide ? 0 : aVide ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return COLLATEUR.compare(String(a), String(b));
}

/**
 * Le tri suivant au clic sur l'en-tête d'une colonne · première pression,
 * croissant ; seconde, décroissant ; troisième, retour à l'ordre du serveur.
 * Une autre colonne repart du croissant.
 */
export function triSuivant(courant: EtatTri | null, cle: string): EtatTri | null {
  if (!courant || courant.cle !== cle) return { cle, sens: 'asc' };
  if (courant.sens === 'asc') return { cle, sens: 'desc' };
  return null;
}

/** La valeur de `aria-sort` de l'en-tête d'une colonne. */
export function ariaSort(tri: EtatTri | null, cle: string): 'ascending' | 'descending' | 'none' {
  if (!tri || tri.cle !== cle) return 'none';
  return tri.sens === 'asc' ? 'ascending' : 'descending';
}

/** Lignes rangées selon la colonne choisie ; sans tri, le tableau tel quel. */
export function trierLignes<T>(
  lignes: readonly T[],
  tri: EtatTri | null,
  colonnes: Readonly<Record<string, (ligne: T) => Cellule>>,
): readonly T[] {
  if (!tri) return lignes;
  const lire = colonnes[tri.cle];
  if (!lire) return lignes;
  const signe = tri.sens === 'asc' ? 1 : -1;
  return lignes
    .map((ligne, rang) => ({ ligne, rang, v: lire(ligne) }))
    .sort((x, y) => {
      const vide = estVide(x.v) || estVide(y.v);
      // L'absence reste en dernier dans les deux sens · le signe ne la touche pas.
      const c = vide ? comparerCellules(x.v, y.v) : signe * comparerCellules(x.v, y.v);
      return c !== 0 ? c : x.rang - y.rang;
    })
    .map((e) => e.ligne);
}

/** Retire accents et casse · « Trésorerie » se retrouve en tapant « tresor ». */
export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Les espaces de l'écran (fine, insécable, ordinaire) et la virgule décimale se lisent pareil. */
function sansEspaces(texte: string): string {
  return texte.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
}

/** Ce qu'un nombre montre à l'écran (`lib/montants.ts`) et ce qu'on en tape · tous lus sans espaces ni virgule. */
function formesDUnNombre(n: number): string[] {
  // Le montant est écrit par `lib/montants.ts`, seul porteur du formatage.
  return [String(n), montant(n)].map(sansEspaces);
}

/**
 * Lignes dont l'une des cellules contient le texte tapé. Un texte vide ne
 * filtre rien. Les nombres se cherchent comme on les lit ou les tape · « 116000 »,
 * « 116 000,00 » et « 116000,50 » retrouvent 116 000,00 et 116 000,50.
 */
export function filtrerLignes<T>(
  lignes: readonly T[],
  texte: string,
  lire: (ligne: T) => ReadonlyArray<Cellule>,
): readonly T[] {
  const cherche = normaliserRecherche(texte);
  if (cherche === '') return lignes;
  const chercheNombre = sansEspaces(cherche);
  return lignes.filter((ligne) =>
    lire(ligne).some((c) => {
      if (c === null || c === undefined) return false;
      if (typeof c === 'number') return formesDUnNombre(c).some((f) => f.includes(chercheNombre));
      const brut = normaliserRecherche(String(c));
      return brut.includes(cherche) || sansEspaces(brut).includes(chercheNombre);
    }),
  );
}

/**
 * La phrase qui dit que tri et filtre ne portent que sur ce qui est à l'écran.
 * `null` quand la liste est entière : rien à avouer. `total` inconnu (le
 * serveur dit seulement qu'il a tronqué) ne s'invente pas.
 */
export function mentionTranche(
  montrees: number,
  total: number | null | undefined,
  tronque: boolean,
): string | null {
  if (!tronque) return null;
  const sur = typeof total === 'number' ? ` sur ${total.toLocaleString('fr-FR')}` : '';
  return `Tri et filtre portent sur les ${montrees.toLocaleString('fr-FR')} lignes affichées${sur}, non sur la liste entière.`;
}
