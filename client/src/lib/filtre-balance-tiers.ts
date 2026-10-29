/**
 * LES FILTRES DE LA BALANCE DES TIERS (ligne gl-saisie, fonction 57 · Sage
 * i7, « comptes mouvementés, soldés, non soldés »). Une lecture de la balance
 * déjà servie, rien n'est redemandé au serveur, qui rend tous les comptes.
 *
 * LE FILTRE SE DIT, ET LE TOTAL GÉNÉRAL RESTE. Une balance filtrée n'est plus
 * la balance auxiliaire · le total des comptes retenus s'affiche à part, sous
 * son nom, et le total de TOUS les comptes demeure, celui qui se rapproche de
 * la balance générale. Le titre imprimé nomme le filtre et le nombre de
 * comptes retenus.
 *
 * DÉFINITIONS D'OMEGAX, dites dans la bulle · « mouvementé », un débit ou un
 * crédit DANS LA PÉRIODE (le report seul ne mouvemente pas) ; « soldé », un
 * solde nul au centime ; « non soldé », tout le reste.
 */
export type FiltreBalanceTiers = 'TOUS' | 'MOUVEMENTES' | 'SOLDES' | 'NON_SOLDES';

export const LIBELLE_FILTRE: Record<FiltreBalanceTiers, string> = {
  TOUS: 'Tous les comptes',
  MOUVEMENTES: 'Mouvementés dans la période',
  SOLDES: 'Soldés',
  NON_SOLDES: 'Non soldés',
};

export interface LigneFiltrable {
  reportDebit: number;
  reportCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
  soldeDebit: number;
  soldeCredit: number;
  solde: number;
}

const nul = (x: number) => Math.abs(x) < 0.005;

export function estRetenu(l: LigneFiltrable, filtre: FiltreBalanceTiers): boolean {
  switch (filtre) {
    case 'TOUS':
      return true;
    case 'MOUVEMENTES':
      return !nul(l.mouvementDebit) || !nul(l.mouvementCredit);
    case 'SOLDES':
      return nul(l.solde);
    case 'NON_SOLDES':
      return !nul(l.solde);
  }
}

export function filtrerBalance<T extends LigneFiltrable>(lignes: T[], filtre: FiltreBalanceTiers): T[] {
  return lignes.filter((l) => estRetenu(l, filtre));
}

/** Le total des comptes retenus, au centime. */
export function totalDesRetenus(lignes: LigneFiltrable[]): Omit<LigneFiltrable, never> {
  const t = { reportDebit: 0, reportCredit: 0, mouvementDebit: 0, mouvementCredit: 0, soldeDebit: 0, soldeCredit: 0, solde: 0 };
  for (const l of lignes) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += l[k];
  for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] = Math.round(t[k] * 100) / 100;
  return t;
}
