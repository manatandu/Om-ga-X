/**
 * LIGNE ANALYTIQUE, FONCTION N° 51 · le budget par compte général, tel que le
 * serveur le rend (`src/modules/analytique/budget-compte.ts`). Rien ne se
 * recalcule à l'écran · l'écart, le sens défavorable et le hors budget sont
 * servis, et un compte non doté porte `budget: null`, jamais zéro.
 */

export type NatureBudget = 'CHARGE' | 'PRODUIT';

export interface LigneBudgetCompte {
  compteId: string;
  numero: string;
  intitule: string;
  nature: NatureBudget;
  budget: number | null;
  realise: number;
  realiseN1: number | null;
  ecart: number | null;
  tauxRealisation: number | null;
  defavorable: boolean;
  horsBudget: boolean;
}

export interface TotauxNature {
  budget: number;
  realise: number;
  realiseN1: number | null;
  horsBudget: number;
}

export interface EtatBudgetComptes {
  exercice: { id: string; dateDebut: string; dateFin: string; statut: string };
  periode: { du: string; au: string; mois: number | null };
  exercicePrecedent: { id: string; du: string; au: string } | null;
  /** Pourquoi la colonne N-1 est vide · `null` quand elle est lue. */
  motifN1: string | null;
  lignes: LigneBudgetCompte[];
  totaux: {
    charges: TotauxNature;
    produits: TotauxNature;
    resultat: { budget: number | null; realise: number | null; realiseN1: number | null };
  };
}

export interface BudgetDuCompte {
  /** `null` · le compte n'est pas doté sur l'exercice. */
  annuel: number | null;
  mensuel: { mois: number; montant: number }[];
}

/**
 * Le report des budgets sur l'exercice suivant, tel que le serveur le rend
 * (`planDuReportBudgetsComptes`) · rien ne s'y recalcule.
 */
export interface ReportBudgetsComptes {
  exercice: { id: string; dateDebut: string; dateFin: string };
  exerciceSuivant: { id: string; dateDebut: string; dateFin: string };
  motifRefus: string | null;
  repris: { compteId: string; numero: string; intitule: string; annuel: number | null }[];
  nonRepris: { compteId: string; numero: string; intitule: string; motif: string }[];
  reporte: boolean;
}

/** Les mois de calendrier d'un exercice (AAAA-MM-JJ), dans l'ordre · même règle que le serveur. */
export function moisDeLExercice(debut: string, fin: string): number[] {
  const mois: number[] = [];
  let annee = Number(debut.slice(0, 4));
  let m = Number(debut.slice(5, 7)) - 1;
  const finA = Number(fin.slice(0, 4));
  const finM = Number(fin.slice(5, 7)) - 1;
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

export const NOMS_DES_MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
