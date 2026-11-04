import { ariaSort, mentionTranche, triSuivant, type EtatTri } from '../lib/grille';

/**
 * LES OUTILS D'UNE GRILLE (lot 3 du design, 2026-11-03) · l'en-tête qui trie
 * et le champ qui filtre. Ils ne travaillent que sur les lignes DÉJÀ LUES
 * (`lib/grille.ts`), et le disent quand la liste est une tranche.
 */

/** Attributs ARIA d'une cellule d'en-tête de colonne qui peut se trier (les grilles sont faites de blocs, jamais de th). */
export function attributsEntete(tri: EtatTri | null, cle: string) {
  return { role: 'columnheader', 'aria-sort': ariaSort(tri, cle) } as const;
}

/**
 * Le bouton d'un en-tête · un clic trie, un second inverse, un troisième
 * rend l'ordre du serveur. L'indicateur n'apparaît que sur la colonne triée :
 * un en-tête non trié garde exactement son dessin d'avant.
 */
export function BoutonTri({
  cle,
  tri,
  onTri,
  children,
  etiquette,
}: {
  cle: string;
  tri: EtatTri | null;
  onTri: (suite: EtatTri | null) => void;
  children: React.ReactNode;
  /** Nom accessible complet quand le texte visible ne suffit pas (« Débit · solde d'ouverture »). */
  etiquette?: string;
}) {
  const actif = tri?.cle === cle;
  return (
    <button
      type="button"
      className="bouton-tri"
      aria-label={etiquette}
      title={actif ? (tri.sens === 'asc' ? 'Trié du plus petit au plus grand · cliquer pour inverser' : 'Trié du plus grand au plus petit · cliquer pour retrouver l’ordre d’origine') : 'Cliquer pour trier'}
      onClick={() => onTri(triSuivant(tri, cle))}
    >
      {children}
      {actif && (
        <span aria-hidden="true" className="marque-tri">
          {tri.sens === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </button>
  );
}

/**
 * Le champ de filtre d'une grille, et la mention qui dit ce qu'il filtre ·
 * le nombre de lignes montrées sur celles lues, et, quand le serveur a
 * tronqué, que le filtre (comme le tri) ne porte que sur la tranche.
 */
export function FiltreGrille({
  valeur,
  onChange,
  etiquette,
  lues,
  montrees,
  total,
  tronque = false,
  className = '',
}: {
  valeur: string;
  onChange: (v: string) => void;
  etiquette: string;
  lues: number;
  montrees: number;
  total?: number | null;
  tronque?: boolean;
  className?: string;
}) {
  const mention = mentionTranche(lues, total, tronque);
  const filtre = valeur.trim() !== '';
  return (
    <span className={`inline-flex items-center gap-2 flex-wrap text-[11.5px] ${className}`}>
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-label={etiquette}
        placeholder="Filtrer…"
        className="border border-border-dark bg-surface px-2 py-[2px] text-[11.5px] w-44"
      />
      {filtre && (
        <span role="status" className="text-text-dim">
          {montrees.toLocaleString('fr-FR')} ligne{montrees > 1 ? 's' : ''} sur {lues.toLocaleString('fr-FR')} lue{lues > 1 ? 's' : ''}
        </span>
      )}
      {mention && (filtre || tronque) && <span className="text-warning">{mention}</span>}
    </span>
  );
}
