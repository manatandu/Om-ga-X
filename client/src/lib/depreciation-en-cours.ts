/**
 * LE COMPTE 29 QUI PORTE LA DÉPRÉCIATION EN PLACE (ligne A22) · le serveur
 * n'admet plus qu'un compte 29 par bien tant qu'une dépréciation est en place
 * (`src/modules/immobilisations/depreciation-en-cours.ts`), y compris le
 * 29x9 d'un bien achevé dont la dépréciation n'a pas été transférée (ligne
 * A22 bis, `depreciationEnCoursATransferer` ci-dessous). L'écran
 * présélectionne ce compte, sans recalculer la règle · le refus reste au
 * serveur. Null quand rien n'est en place, quand un mouvement ne dit pas son
 * compte, ou quand deux comptes portent un reste (historique réparti, le
 * cabinet choisit).
 */
export function compte29EnPlace(
  depreciations: readonly { sens: 'DOTATION' | 'REPRISE'; montant: number; compteDepreciationId?: string | null }[],
): string | null {
  const cumuls = new Map<string, number>();
  for (const d of depreciations) {
    if (!d.compteDepreciationId) return null;
    const signe = d.sens === 'DOTATION' ? 1 : -1;
    cumuls.set(d.compteDepreciationId, Math.round(((cumuls.get(d.compteDepreciationId) ?? 0) + signe * d.montant) * 100) / 100);
  }
  const porteurs = [...cumuls.entries()].filter(([, c]) => Math.abs(c) > 0.005);
  return porteurs.length === 1 ? porteurs[0][0] : null;
}

/**
 * LIGNE A22 BIS · la dépréciation restée au 29x9 d'un bien DÉJÀ mis en service
 * (mis en service avant le transfert, ou porté d'emblée à son compte
 * définitif) · l'écran offre alors « Transférer la dépréciation ». Le numéro
 * se lit dans le plan servi ; null quand rien n'est en place, quand le
 * porteur n'est pas un 29x9 (2919, 2929, 2939, 2949) ou quand il est inconnu.
 */
export function depreciationEnCoursATransferer(
  depreciations: readonly { sens: 'DOTATION' | 'REPRISE'; montant: number; compteDepreciationId?: string | null }[],
  comptes: readonly { id: string; numero: string }[],
): { compteId: string; numero: string; montant: number } | null {
  const porteur = compte29EnPlace(depreciations);
  if (!porteur) return null;
  const numero = comptes.find((c) => c.id === porteur)?.numero;
  if (!numero || !/^29[1-4]9/.test(numero)) return null;
  const montant = depreciations
    .filter((d) => d.compteDepreciationId === porteur)
    .reduce((t, d) => Math.round((t + (d.sens === 'DOTATION' ? d.montant : -d.montant)) * 100) / 100, 0);
  return montant > 0.005 ? { compteId: porteur, numero, montant } : null;
}
