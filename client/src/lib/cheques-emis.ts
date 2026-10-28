/**
 * REGISTRE DES CHÈQUES ÉMIS · l'état tel que le serveur le LIT (ligne
 * microfina-m2, idée 9). Les libellés sont écrits une fois · « encaissé » se
 * lit au rapprochement bancaire, il ne se saisit jamais.
 */
export type EtatChequeLu = 'EMIS_SANS_PIECE' | 'EN_CIRCULATION' | 'ENCAISSE' | 'PIECE_ANNULEE' | 'ANNULE';

export const LIBELLES_ETAT_CHEQUE: Record<EtatChequeLu, string> = {
  EMIS_SANS_PIECE: 'Émis, sans pièce',
  EN_CIRCULATION: 'En circulation',
  ENCAISSE: 'Encaissé',
  PIECE_ANNULEE: 'Pièce annulée au journal',
  ANNULE: 'Annulé',
};
