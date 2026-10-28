import type { EtatVisaPiece, NaturePiece, ResultatVisa } from './types';

/**
 * LE CIRCUIT DE VISA À L'ÉCRAN (ligne microfina-m1, idée 1). Les règles
 * vivent au serveur (`src/modules/comptabilite/circuit-visa.ts`) · l'écran
 * nomme les états et dit le compte rendu, rien d'autre.
 */

export const LIBELLES_NATURE_PIECE: Record<NaturePiece, string> = {
  SAISIE: 'Saisie',
  OD: 'Opération diverse',
  FACTURE: 'Facture',
  REGLEMENT: 'Règlement',
};

export const LIBELLES_ETAT_VISA: Record<EtatVisaPiece, string> = {
  A_VISER: 'À viser',
  VISEE: 'Visée',
  VISA_TOMBE: 'Visa tombé',
};

/** Le compte rendu d'un visa · chaque refus et chaque avertissement nommés, jamais un seul compteur. */
export function phraseDuVisa(r: ResultatVisa): string {
  const refus = r.refusees.map((x) => `${x.piece} · ${x.motif}`);
  const avertis = r.avertissements.map((x) => `${x.piece} · ${x.avertissement}`);
  return [
    `${r.visees} pièce(s) visée(s).`,
    refus.length > 0 ? `${refus.length} refusée(s) · ${refus.join(' ')}` : null,
    avertis.length > 0 ? avertis.join(' ') : null,
  ]
    .filter(Boolean)
    .join(' ');
}
