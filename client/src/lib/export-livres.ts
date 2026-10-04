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

let ouvertures = 0;

/**
 * L'adresse qui ouvre le grand livre filtré sur un compte · double-clic d'une
 * balance. Elle porte un JETON D'OUVERTURE, nouveau à chaque appel · la
 * fenêtre Journal ne relit le compte que lorsque son adresse CHANGE, et un
 * second double-clic sur le même tiers (le filtre changé entre-temps à la
 * main) aurait rendu une adresse identique, donc sans effet (second tour,
 * relevé E).
 */
export function adresseGrandLivreDuCompte(compteId: string): string {
  ouvertures += 1;
  return `/journal?onglet=grand-livre&compte=${encodeURIComponent(compteId)}&ouverture=${Date.now().toString(36)}-${ouvertures}`;
}

/**
 * Les familles qu'une balance « Tous les tiers » (40 et 41) porte · un
 * classeur ne s'exporte que par famille, et l'écran propose celles-là.
 */
export function famillesDeLaBalanceTous(numeros: readonly string[]): FamilleTiers[] {
  const familles: FamilleTiers[] = [];
  if (numeros.some((n) => n.startsWith('40'))) familles.push('FOURNISSEURS');
  if (numeros.some((n) => n.startsWith('41'))) familles.push('CLIENTS');
  return familles;
}

/**
 * La famille exportée · celle du type affiché, ou sur « Tous » celle choisie
 * dans la liste, présélectionnée quand la balance n'en porte qu'une. Aucune
 * n'est devinée entre deux · `null` laisse les boutons d'export fermés.
 */
export function familleExportee(
  type: FamilleTiers | 'TOUS',
  choix: FamilleTiers | null,
  presentes: readonly FamilleTiers[],
): FamilleTiers | null {
  if (type !== 'TOUS') return type;
  if (choix && presentes.includes(choix)) return choix;
  return presentes.length === 1 ? presentes[0] : null;
}

/** Le compte demandé par l'adresse d'une fenêtre (`?compte=…`), ou rien. */
export function compteDeLAdresse(adresse: string | undefined): string | null {
  const brut = new URLSearchParams(adresse?.split('?')[1] ?? '').get('compte');
  return brut ? brut : null;
}

/** Le grand livre d'UN compte, tel que `GET /ecritures/grand-livre/:compteId` le sert. */
export interface GrandLivreDuCompte<L extends { debit: number; credit: number }> {
  compte: { id: string; numero: string; intitule: string };
  lignes: L[];
  soldeFinal: number;
}

/**
 * LE GRAND LIVRE D'UN SEUL COMPTE, mis dans la forme d'une section du livre
 * complet · la fenêtre Journal l'ouvre quand le livre complet y est refusé
 * (second tour, relevé E). Les totaux se refont au centime sur ses lignes, la
 * route ne les servant pas.
 */
export function sectionDuCompteSeul<L extends { debit: number; credit: number }>(r: GrandLivreDuCompte<L>) {
  const centimes = (f: (l: L) => number) => Math.round(r.lignes.reduce((t, l) => t + Math.round(f(l) * 100), 0)) / 100;
  return {
    compte: { id: r.compte.id, numero: r.compte.numero, intitule: r.compte.intitule },
    lignes: r.lignes,
    soldeFinal: r.soldeFinal,
    totalDebit: centimes((l) => l.debit),
    totalCredit: centimes((l) => l.credit),
  };
}
