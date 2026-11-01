/**
 * LA PAIE AU BROUILLARD N'EST PAS LUE PAR LE REGISTRE DES RETENUES (ligne
 * paie-declarations, gel levé par Manasse le 2026-11-01). Le registre ne lit
 * que le livre-journal (AUDCIF art. 22, 2°) · un mois dont la paie est passée
 * mais pas validée se lisait « rien à reverser ». Le serveur COMPTE les pièces
 * de paie au brouillard (liaison au bulletin, `retenues.service.ts`), l'écran
 * le dit sans rien chiffrer.
 */

/** Le nombre servi par le serveur, l'un ou l'autre des deux états · 0 quand il ne le dit pas. */
export function piecesDePaieAuBrouillard(
  registre: { piecesDePaieAuBrouillard?: number } | null,
  echeancier: { piecesDePaieAuBrouillard?: number } | null,
): number {
  return registre?.piecesDePaieAuBrouillard ?? echeancier?.piecesDePaieAuBrouillard ?? 0;
}

export function libellePiecesDePaieAuBrouillard(n: number): string {
  return n === 1
    ? '1 pièce de paie est encore au brouillard · ses retenues ne sont pas lues par le registre. Validez-la au journal pour qu’elles y figurent.'
    : `${n} pièces de paie sont encore au brouillard · leurs retenues ne sont pas lues par le registre. Validez-les au journal pour qu’elles y figurent.`;
}
