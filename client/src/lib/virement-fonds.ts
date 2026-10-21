/**
 * VIREMENT DE FONDS · ce que l'écran affiche avant que le serveur juge.
 * Règle source · src/modules/virements-fonds/virement-fonds.ts (le sens se lit
 * sur les comptes des deux journaux, une caisse est un 57). Tenue en MIROIR ·
 * virement-fonds.spec.ts rejoue les mêmes cas des deux côtés.
 */
export type SensVirementFonds = 'BANQUE_BANQUE' | 'BANQUE_CAISSE' | 'CAISSE_BANQUE' | 'CAISSE_CAISSE';
export type NaturePieceVirement =
  | 'BORDEREAU_VERSEMENT'
  | 'CHEQUE'
  | 'ORDRE_VIREMENT'
  | 'AVIS_DEBIT_CREDIT'
  | 'BON_CAISSE'
  | 'AUTRE'
  | 'BON_SORTIE_CAISSE'
  | 'BON_ENTREE_CAISSE'
  | 'AVIS_DEBIT'
  | 'AVIS_CREDIT'
  | 'EXTRAIT_COMPTE'
  | 'BORDEREAU_REMISE_CHEQUE';

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

/**
 * DEUX OPÉRATIONS, DEUX PIÈCES (demande de Manasse du 2026-10-16) · la sortie
 * des fonds au journal d'origine, leur entrée au journal de destination,
 * chacune appuyée et datée par SA pièce (AUDCIF art. 16, al. 2 ; art. 17, 3°
 * et 5°). Le sens et le compte de passage ne s'affichent plus · ils restent
 * au journal et au plan comptable.
 */
export type OperationVirementFonds = 'SORTIE' | 'ENTREE';

export const LIBELLES_OPERATION: Readonly<Record<OperationVirementFonds, string>> = {
  SORTIE: 'sortie des fonds',
  ENTREE: 'entrée des fonds',
};

/**
 * LES PIÈCES PROPOSÉES SELON LA TRÉSORERIE ET L'OPÉRATION · miroir de
 * NATURES_PROPOSEES du serveur (src/modules/virements-fonds/virement-fonds.ts,
 * tableau des pièces de trésorerie du CPCC), qui refuse le reste.
 */
export const NATURES_PROPOSEES: Readonly<
  Record<'BANQUE' | 'CAISSE', Readonly<Record<OperationVirementFonds, readonly NaturePieceVirement[]>>>
> = {
  CAISSE: {
    SORTIE: ['BON_SORTIE_CAISSE', 'AUTRE'],
    ENTREE: ['BON_ENTREE_CAISSE', 'AUTRE'],
  },
  BANQUE: {
    SORTIE: ['ORDRE_VIREMENT', 'CHEQUE', 'AVIS_DEBIT', 'EXTRAIT_COMPTE', 'AUTRE'],
    ENTREE: ['BORDEREAU_VERSEMENT', 'BORDEREAU_REMISE_CHEQUE', 'AVIS_CREDIT', 'EXTRAIT_COMPTE', 'AUTRE'],
  },
};

/**
 * Les pièces proposées pour le compte de trésorerie d'UNE opération · vide
 * tant que sa banque ou sa caisse n'est pas choisie.
 */
export function naturesDeLaPiece(numeroCompte: string | null, operation: OperationVirementFonds): readonly NaturePieceVirement[] {
  if (!numeroCompte) return [];
  return NATURES_PROPOSEES[estUneCaisse(numeroCompte) ? 'CAISSE' : 'BANQUE'][operation];
}

export const LIBELLES_NATURE_PIECE: Readonly<Record<NaturePieceVirement, string>> = {
  BORDEREAU_VERSEMENT: 'Bordereau de versement',
  CHEQUE: 'Chèque',
  ORDRE_VIREMENT: 'Ordre de virement',
  AVIS_DEBIT_CREDIT: 'Avis de débit ou de crédit',
  BON_CAISSE: 'Bon de caisse',
  AUTRE: 'Autre pièce',
  BON_SORTIE_CAISSE: 'Bon de sortie de caisse',
  BON_ENTREE_CAISSE: "Bon d'entrée de caisse",
  AVIS_DEBIT: 'Avis de débit',
  AVIS_CREDIT: 'Avis de crédit',
  EXTRAIT_COMPTE: 'Extrait de compte',
  BORDEREAU_REMISE_CHEQUE: 'Bordereau de remise de chèque',
};
