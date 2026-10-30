/**
 * LIGNE ANALYTIQUE, FONCTION N° 51 · LE BUDGET PAR COMPTE GÉNÉRAL.
 *
 * Sage (manuel 1, ligne 29 ; manuel 2, ligne 57) dote un budget sur le compte
 * général et compare la réalisation à celle de l'exercice précédent. OmegaX
 * ne dotait que les sections analytiques · une société budgète ses charges et
 * ses produits par compte. AUCUN TEXTE NE RÉGIT CE BUDGET · ni l'AUDCIF ni le
 * SYCEBNL n'en demandent un hors du tableau d'exécution des projets de
 * développement, qui lit les budgets des SECTIONS et ne lit pas celui-ci. Les
 * règles ci-dessous sont des CONVENTIONS D'OMEGAX, dites dans la bulle. Les
 * postes budgétaires, la prévision faible ou forte et la devise d'édition de
 * Sage ne sont pas repris (plan du 2026-10-29).
 *
 * QUATRE DÉCISIONS, DÉCLARÉES.
 *  1. LE BUDGET SE PORTE SUR UN COMPTE DE DÉTAIL DES CLASSES 6 ET 7 · comme le
 *     simulateur budgétaire, le résultat budgété est celui des activités
 *     ordinaires (classe 8 et impôt hors champ). Le réalisé d'un compte est
 *     celui du compte, et d'aucun autre · un sous-compte ouvert sous lui a
 *     sa propre ligne, « hors budget » s'il n'est pas doté.
 *  2. LE RÉALISÉ EST UN MOUVEMENT DE L'EXERCICE, écriture qui solde les
 *     comptes de gestion exclue (`filtresDesTroisColonnes`, audit final F4) ·
 *     lu au solde, un exercice clos vaudrait zéro partout. Brouillard
 *     compris, et dit ; jamais une écriture de situation.
 *  3. UNE CHARGE SE LIT DÉBIT MOINS CRÉDIT, UN PRODUIT CRÉDIT MOINS DÉBIT · une
 *     remise obtenue enregistrée en déduction d'une charge la diminue (même
 *     sens que le simulateur). L'écart est budget moins réalisé ; il est
 *     DÉFAVORABLE quand une charge dépasse son budget ou qu'un produit n'y
 *     arrive pas.
 *  4. LA DOTATION SE RÉPARTIT SUR LES MOIS DE L'EXERCICE, au centime, le
 *     reliquat sur le dernier (même règle que la section), chaque mois
 *     retouchable ensuite, l'annuel suivant la somme. Un exercice de plus de
 *     douze mois se dote à l'année, sans répartition (audit final F39).
 *     N-1 est l'exercice du dossier qui précède immédiatement, lu de la même
 *     façon, au même mois de calendrier quand un mois est choisi.
 */

export type NatureBudget = 'CHARGE' | 'PRODUIT';

/** Classes que le budget par compte admet, en chiffre. */
export const CLASSES_BUDGETABLES = ['6', '7'] as const;

/** La nature d'un compte budgétable par sa classe, ou `null` hors des classes 6 et 7. */
export function natureDuCompte(classe: string): NatureBudget | null {
  const chiffre = classe.replace('CLASSE_', '');
  if (chiffre === '6') return 'CHARGE';
  if (chiffre === '7') return 'PRODUIT';
  return null;
}

/** Le refus d'un compte à doter, ou `null`. */
export function motifRefusCompteBudgetable(compte: { numero: string; classe: string; estTotal: boolean } | null): string | null {
  if (!compte) return 'Compte introuvable dans ce dossier.';
  if (compte.estTotal) {
    return `Le compte ${compte.numero} est un compte de regroupement · le budget se porte sur le compte de détail qui reçoit les écritures.`;
  }
  if (!natureDuCompte(compte.classe)) {
    return `Le compte ${compte.numero} n'est ni une charge ni un produit des activités ordinaires · le budget par compte porte sur les classes 6 et 7.`;
  }
  return null;
}

/** Le refus d'un montant budgété, ou `null` · positif ou nul, au centime. */
export function motifRefusMontantBudget(montant: number): string | null {
  if (!Number.isFinite(montant)) return 'Le montant du budget est un nombre.';
  if (montant < 0) return "Un budget n'est pas négatif · une charge ou un produit se budgète à sa valeur.";
  if (Math.abs(Math.round(montant * 100) - montant * 100) > 1e-6) return 'Le montant du budget se donne au centime.';
  if (montant > 1e15) return 'Montant hors des bornes de la base.';
  return null;
}

/**
 * La dotation annuelle répartie sur `nombre` mois, au centime, le reliquat sur
 * le dernier · la somme des mois égale l'annuel exactement.
 */
export function repartirSurLesMois(montant: number, nombre: number): number[] {
  if (nombre <= 0) return [];
  const centimes = Math.round(montant * 100);
  const part = Math.trunc(centimes / nombre);
  const reliquat = centimes - part * nombre;
  return Array.from({ length: nombre }, (_, i) => (part + (i === nombre - 1 ? reliquat : 0)) / 100);
}

/** Les mois de calendrier (1 à 12) d'un exercice, dans l'ordre, en UTC. */
export function moisDeLExercice(debut: Date, fin: Date): number[] {
  const mois: number[] = [];
  let annee = debut.getUTCFullYear();
  let m = debut.getUTCMonth();
  const finA = fin.getUTCFullYear();
  const finM = fin.getUTCMonth();
  while (annee < finA || (annee === finA && m <= finM)) {
    mois.push(m + 1);
    m += 1;
    if (m === 12) {
      m = 0;
      annee += 1;
    }
  }
  return mois;
}

/** Le montant d'un compte dans le sens de sa nature. */
export function realiseDansLeSens(nature: NatureBudget, debit: number, credit: number): number {
  return nature === 'CHARGE' ? debit - credit : credit - debit;
}

export type LigneBudgetCompte = {
  compteId: string;
  numero: string;
  intitule: string;
  nature: NatureBudget;
  /** `null` · le compte n'est pas doté sur la période · jamais un zéro qui passerait pour un budget. */
  budget: number | null;
  realise: number;
  /** `null` · aucun exercice précédent lisible (dit par `motifN1`). */
  realiseN1: number | null;
  /** Budget moins réalisé · `null` sans budget. */
  ecart: number | null;
  /** Réalisé en % du budget · `null` sans budget ou à budget nul. */
  tauxRealisation: number | null;
  /** Une charge qui dépasse son budget, un produit qui n'y arrive pas. */
  defavorable: boolean;
  /** Mouvementé, ou mouvementé en N-1, sans budget. */
  horsBudget: boolean;
};

const arrondi = (x: number) => Math.round(x * 100) / 100;

/** Une ligne de l'état, à partir de ses trois lectures. */
export function ligneDuBudget(params: {
  compteId: string;
  numero: string;
  intitule: string;
  nature: NatureBudget;
  budget: number | null;
  realise: number;
  realiseN1: number | null;
}): LigneBudgetCompte {
  const { budget, nature } = params;
  const realise = arrondi(params.realise);
  const realiseN1 = params.realiseN1 === null ? null : arrondi(params.realiseN1);
  const ecart = budget === null ? null : arrondi(budget - realise);
  const centimes = (x: number) => Math.round(x * 100);
  const defavorable =
    budget !== null && (nature === 'CHARGE' ? centimes(realise) > centimes(budget) : centimes(realise) < centimes(budget));
  return {
    ...params,
    realise,
    realiseN1,
    ecart,
    tauxRealisation: budget !== null && centimes(budget) !== 0 ? (realise / budget) * 100 : null,
    defavorable,
    horsBudget: budget === null && (centimes(realise) !== 0 || (realiseN1 !== null && centimes(realiseN1) !== 0)),
  };
}

/** Les totaux d’une nature · le budget ne somme que les comptes dotés, le hors budget est compté à part. */
export function totauxDeLaNature(lignes: readonly LigneBudgetCompte[], nature: NatureBudget) {
  const de = lignes.filter((l) => l.nature === nature);
  const budget = arrondi(de.reduce((t, l) => t + (l.budget ?? 0), 0));
  const realise = arrondi(de.reduce((t, l) => t + l.realise, 0));
  const n1 = de.some((l) => l.realiseN1 === null) ? null : arrondi(de.reduce((t, l) => t + (l.realiseN1 ?? 0), 0));
  return { budget, realise, realiseN1: n1, horsBudget: arrondi(de.filter((l) => l.horsBudget).reduce((t, l) => t + l.realise, 0)) };
}
