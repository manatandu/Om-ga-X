/**
 * LES ÉCHÉANCES PROCHES DES TIERS, AU TABLEAU DE BORD (ligne gl-saisie,
 * fonction 34). Ce que le serveur rend (`EcheancesTiersService`), et les mots
 * de l'écran · rien n'est recalculé ici.
 *
 * AUCUN « À JOUR » · une liste vide veut dire rien dans l'horizon, et une
 * ligne sans échéance n'alerte pas, elle est comptée à part.
 */
export interface CumulEcheances {
  nombre: number;
  aEncaisser: number;
  aPayer: number;
}

export interface EcheanceTiers {
  ligneId: string;
  date: string;
  joursRestants: number;
  sens: 'A_ENCAISSER' | 'A_PAYER';
  compteNumero: string;
  tiers: string | null;
  libelle: string;
  montant: number;
}

export interface EcheancesTiers {
  dateReference: string;
  horizonJours: number;
  aEchoir: CumulEcheances;
  echu: CumulEcheances;
  sansEcheance: number;
  proches: EcheanceTiers[];
  tronque: boolean;
}

/** « aujourd'hui », « demain », « dans 9 j » · une échéance du panneau n'est jamais passée. */
export function libelleJoursRestants(jours: number): string {
  if (jours === 0) return 'aujourd’hui';
  if (jours === 1) return 'demain';
  return `dans ${jours} j`;
}

export function libelleSens(sens: EcheanceTiers['sens']): string {
  return sens === 'A_ENCAISSER' ? 'à encaisser' : 'à payer';
}
