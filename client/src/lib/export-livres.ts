/**
 * LES EXPORTS DES BALANCES ET DES GRANDS LIVRES (ligne FPM, 2026-10-04) · les
 * adresses que les écrans appellent, écrites une seule fois.
 *
 * Deux décisions de Manasse · la présentation du cabinet est celle PAR DÉFAUT
 * (blocs par compte, totaux, contrôle contre la balance), le grand livre « à
 * plat » reste en second choix ; la balance porte une feuille par compte,
 * sauf « balance seule », chemin de rechange au-delà du plafond de volume.
 */

export type FormatGrandLivre = 'fpm' | 'plat';
export type FamilleTiers = 'FOURNISSEURS' | 'CLIENTS' | 'SALARIES' | 'AUTRES';

/** Le grand livre complet · `format=plat` n'est envoyé que s'il est choisi. */
export function cheminGrandLivre(exerciceId: string, format: FormatGrandLivre): string {
  return `/exports/grand-livre?exerciceId=${exerciceId}${format === 'plat' ? '&format=plat' : ''}`;
}

/** La balance des comptes · avec une feuille par compte, sauf balance seule. */
export function cheminBalance(exerciceId: string, balanceSeule: boolean): string {
  return `/exports/balance?exerciceId=${exerciceId}${balanceSeule ? '&grandsLivres=non' : ''}`;
}

/** La balance des tiers d'une famille · un classeur par famille. */
export function cheminBalanceTiers(exerciceId: string, famille: FamilleTiers, balanceSeule: boolean): string {
  return `/exports/balance-auxiliaire?exerciceId=${exerciceId}&type=${famille}${balanceSeule ? '&grandsLivres=non' : ''}`;
}

/** Le grand-livre des tiers d'une famille. */
export function cheminGrandLivreTiers(exerciceId: string, famille: FamilleTiers): string {
  return `/exports/grand-livre-tiers?exerciceId=${exerciceId}&type=${famille}`;
}

/** L'adresse qui ouvre le grand livre filtré sur un compte · double-clic d'une balance. */
export function adresseGrandLivreDuCompte(compteId: string): string {
  return `/journal?onglet=grand-livre&compte=${encodeURIComponent(compteId)}`;
}

/** Le compte demandé par l'adresse d'une fenêtre (`?compte=…`), ou rien. */
export function compteDeLAdresse(adresse: string | undefined): string | null {
  const brut = new URLSearchParams(adresse?.split('?')[1] ?? '').get('compte');
  return brut ? brut : null;
}
