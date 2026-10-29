/**
 * LA SORTIE GLOBALE (ligne immos, n° 69) · le corps de
 * `POST /immobilisations/sortie-globale`, tiré des lignes cochées. Un prix
 * illisible ne part jamais, et n'est jamais lu comme zéro.
 *
 * AUCUN IMPORT DE REACT (specs-sans-react.spec.ts).
 */

export interface LigneSortieGlobale {
  choisi: boolean;
  /** Le prix tapé · espaces et virgule décimale admis. */
  prix: string;
}

function lirePrix(s: string): number | null {
  const t = s.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return null;
  const x = Number(t);
  return Number.isFinite(x) && x >= 0 ? x : null;
}

export function corpsSortieGlobale(
  lignes: Record<string, LigneSortieGlobale>,
  type: 'CESSION' | 'MISE_HORS_SERVICE',
): { biens: { immobilisationId: string; prixCession?: number }[] } | { motif: string } {
  const choisis = Object.entries(lignes).filter(([, l]) => l.choisi);
  if (choisis.length < 2) return { motif: 'Cochez au moins deux biens · un bien seul sort par « Sortir ».' };
  if (type === 'MISE_HORS_SERVICE') return { biens: choisis.map(([id]) => ({ immobilisationId: id })) };
  const biens: { immobilisationId: string; prixCession: number }[] = [];
  let illisibles = 0;
  for (const [id, l] of choisis) {
    const p = lirePrix(l.prix);
    if (p === null) illisibles += 1;
    else biens.push({ immobilisationId: id, prixCession: p });
  }
  if (illisibles > 0) return { motif: `${illisibles} prix de cession manquant(s) ou illisible(s) · une cession porte le prix de chaque bien.` };
  return { biens };
}
