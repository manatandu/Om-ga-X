/**
 * LE FILTRE DU RAPPROCHEMENT (ligne gl-saisie, fonction 58 · Sage i7,
 * « écritures rapprochées ou non »). Une lecture des lignes déjà servies ·
 * les lignes du compte et les en-cours d'ouverture, pointés ou non. Les
 * soldes du rapprochement ne bougent pas, ils portent tout le compte ; seule
 * la liste se restreint, et le nombre de lignes cachées se dit. Sur une liste
 * déjà tronquée par le serveur, le filtre ne lit que la tranche servie, et
 * l'écran le dit aussi.
 */
export type FiltreRapprochement = 'TOUTES' | 'RAPPROCHEES' | 'NON_RAPPROCHEES';

export const LIBELLE_FILTRE_RAPPROCHEMENT: Record<FiltreRapprochement, string> = {
  TOUTES: 'Toutes les lignes',
  RAPPROCHEES: 'Rapprochées',
  NON_RAPPROCHEES: 'Non rapprochées',
};

export function filtrerPointees<T extends { pointee: boolean }>(lignes: T[], filtre: FiltreRapprochement): T[] {
  if (filtre === 'TOUTES') return lignes;
  return lignes.filter((l) => (filtre === 'RAPPROCHEES' ? l.pointee : !l.pointee));
}

/** Ce que le filtre cache, dit en une ligne · `null` quand rien n'est caché. */
export function mentionFiltreRapprochement(filtre: FiltreRapprochement, caches: number, tronque: boolean): string | null {
  if (filtre === 'TOUTES' || caches === 0) return tronque && filtre !== 'TOUTES' ? 'Filtre appliqué aux seules lignes servies.' : null;
  const quoi = filtre === 'RAPPROCHEES' ? 'non rapprochée' : 'rapprochée';
  const s = caches > 1 ? 's' : '';
  return `${caches} ligne${s} ${quoi}${s} cachée${s}${tronque ? ' parmi les lignes servies' : ''} · les soldes portent tout le compte.`;
}
