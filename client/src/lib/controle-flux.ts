/**
 * LE CONTRÔLE DU TABLEAU DES FLUX A TROIS ISSUES (paquet 1, relecture M1).
 *
 * Le serveur confronte la trésorerie de clôture par les flux à celle du
 * bilan. Quand l'ouverture ou la variation est laissée VIDE (ouverture passée
 * en OD au premier jour), le premier terme n'est pas connu · le contrôle
 * n'est ni réussi ni en échec, `coherent` vaut `null` et `motifNonControlable`
 * le dit. Lu comme un échec, l'écran affichait en rouge un « écart » de toute
 * la trésorerie du dossier, chiffré sur des zéros.
 */
export type IssueControleFlux = 'BOUCLE' | 'ECART' | 'NON_EFFECTUE';

export function issueDuControleDesFlux(coherent: boolean | null | undefined): IssueControleFlux {
  if (coherent === null || coherent === undefined) return 'NON_EFFECTUE';
  return coherent ? 'BOUCLE' : 'ECART';
}

/** Le cadre et l'icône de chaque issue · l'avertissement n'est pas l'erreur. */
export const STYLE_CONTROLE_FLUX: Record<IssueControleFlux, { cadre: string; icone: string }> = {
  BOUCLE: { cadre: 'border-positive/30 bg-positive-soft', icone: 'text-positive' },
  ECART: { cadre: 'border-danger/30 bg-danger-soft', icone: 'text-danger' },
  NON_EFFECTUE: { cadre: 'border-warning/40 bg-warning-soft', icone: 'text-warning' },
};

/** Ce que l'écran dit d'un contrôle non effectué · le motif du serveur, sinon une phrase sûre. */
export function motifDuControleNonEffectue(motif: string | null | undefined): string {
  return motif?.trim() ? motif : "Contrôle non effectué · l'ouverture ou la variation de la trésorerie est laissée vide.";
}
