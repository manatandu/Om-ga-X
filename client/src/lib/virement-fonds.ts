/**
 * VIREMENT DE FONDS · ce que l'écran affiche avant que le serveur juge.
 * Règle source · src/modules/virements-fonds/virement-fonds.ts (le sens se lit
 * sur les comptes des deux journaux, une caisse est un 57). Tenue en MIROIR ·
 * virement-fonds.spec.ts rejoue les mêmes cas des deux côtés.
 */
export type SensVirementFonds = 'BANQUE_BANQUE' | 'BANQUE_CAISSE' | 'CAISSE_BANQUE' | 'CAISSE_CAISSE';
export type NaturePieceVirement = 'BORDEREAU_VERSEMENT' | 'CHEQUE' | 'ORDRE_VIREMENT' | 'AVIS_DEBIT_CREDIT' | 'BON_CAISSE' | 'AUTRE';

export function estUneCaisse(numeroCompte: string): boolean {
  return numeroCompte.startsWith('57');
}

export function sensDuVirement(numeroOrigine: string, numeroDestination: string): SensVirementFonds {
  const o = estUneCaisse(numeroOrigine) ? 'CAISSE' : 'BANQUE';
  const d = estUneCaisse(numeroDestination) ? 'CAISSE' : 'BANQUE';
  return `${o}_${d}` as SensVirementFonds;
}

/** Le porteur des espèces est exigé dès qu'une caisse est en jeu (convention d'OmegaX). */
export function caisseEnJeu(sens: SensVirementFonds): boolean {
  return sens !== 'BANQUE_BANQUE';
}

const LIBELLES_SENS: Readonly<Record<SensVirementFonds, string>> = {
  BANQUE_BANQUE: 'banque vers banque',
  BANQUE_CAISSE: 'banque vers caisse',
  CAISSE_BANQUE: 'caisse vers banque',
  CAISSE_CAISSE: 'caisse vers caisse',
};

export function libelleSens(sens: SensVirementFonds): string {
  return LIBELLES_SENS[sens] ?? sens;
}

export const NATURES_PIECE: readonly NaturePieceVirement[] = [
  'ORDRE_VIREMENT',
  'CHEQUE',
  'BORDEREAU_VERSEMENT',
  'AVIS_DEBIT_CREDIT',
  'BON_CAISSE',
  'AUTRE',
];

export const LIBELLES_NATURE_PIECE: Readonly<Record<NaturePieceVirement, string>> = {
  BORDEREAU_VERSEMENT: 'Bordereau de versement',
  CHEQUE: 'Chèque',
  ORDRE_VIREMENT: 'Ordre de virement',
  AVIS_DEBIT_CREDIT: 'Avis de débit ou de crédit',
  BON_CAISSE: 'Bon de caisse',
  AUTRE: 'Autre pièce',
};
