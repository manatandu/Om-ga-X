/**
 * LIGNE SAGE-L5, FONCTION 78 · ce que l'écran des absences lit du serveur.
 * Aucune règle ici · les jours, les régimes et la proposition du mois sont
 * rejoués au serveur (`personnel/absences.ts`).
 */

export type RegimeRemuneration = 'DUE' | 'DEUX_TIERS' | 'NON_DUE' | 'ARRETE_ABSENT';

export interface NatureCatalogue {
  cle: string;
  libelle: string;
  fondement: string;
  regime: RegimeRemuneration;
  piece: string | null;
  demiJournees: boolean;
}

export interface Catalogue {
  natures: NatureCatalogue[];
  evenements: { cle: string; libelle: string; jours: number }[];
}

export interface AbsenceLue {
  id: string;
  nature: string;
  libelle: string;
  fondement: string;
  regime: RegimeRemuneration;
  du: string;
  au: string;
  demiJourneeDebut: boolean;
  demiJourneeFin: boolean;
  evenement: string | null;
  piece: string | null;
  observation: string | null;
  joursOuvrables: number | null;
  joursCalendaires: number | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  /** Premier jour de la suspension que la fiche continue (fiches contiguës de même nature) · `null` si annulée. */
  debutSuspension: string | null;
  /** Ce que le texte dit d'un arrêt qui dure (art. 60, a ; art. 106) · information. */
  informations: string[];
  indemnitesCaisse: IndemniteCaisseLue[];
}

export type TraitementIndemniteCaisse = 'DEDUITE' | 'SUBROGATION' | 'SUBROGATION_PARTIELLE';

export interface IndemniteCaisseLue {
  id: string;
  mois: string;
  montant: number;
  traitement: TraitementIndemniteCaisse;
  piece: string;
  annuleLe: string | null;
  motifAnnulation: string | null;
}

export const LIBELLE_TRAITEMENT: Record<TraitementIndemniteCaisse, string> = {
  DEDUITE: 'Déduite de l’indemnité',
  SUBROGATION: 'Subrogation, rémunération entière',
  SUBROGATION_PARTIELLE: 'Subrogation, deux tiers versés',
};

/** Les traitements ouverts à une cause · chacun son texte (art. 106, al. 2 ; arrêté n° 146/2018, art. 139 et 146). */
export function traitementsOuverts(nature: string): TraitementIndemniteCaisse[] {
  if (nature === 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE') return ['DEDUITE', 'SUBROGATION'];
  if (nature === 'MATERNITE') return ['SUBROGATION', 'SUBROGATION_PARTIELLE'];
  return [];
}

export interface PropositionDuMois {
  joursDeuxTiers: number;
  joursNonDus: number;
  joursNonTranches: number;
  /** Jours du mois payés par l'allocation de congé, hors du salaire (art. 142). */
  joursDeConge: number;
  joursPayesAPlein: number | null;
  salaireDesJoursDus: number | null;
  indemniteDeuxTiers: number | null;
  deductionsCaisse: number;
  /** `null` · la subrogation partielle ne se borne pas tant que les deux tiers ne se chiffrent pas. */
  aRecevoirDeLaCaisse: number | null;
  /** Vingt-six, ou les jours payables du mois quand l'absence le couvre en entier. */
  baseDuMois: number;
  motifs: string[];
  explication: string | null;
}

export interface AbsencesDuMois {
  mois: string;
  devise: string | null;
  salaireMensuel: number | null;
  absences: { id: string; nature: string; libelle: string; du: string; au: string; joursDuMois: number; regimes: RegimeRemuneration[] }[];
  /** Les congés payés qui touchent le mois · leurs jours sortent du salaire (art. 142). */
  conges: CongeDuMoisPaye[];
  proposition: PropositionDuMois;
}

export interface CongeDuMoisPaye {
  id: string;
  du: string;
  au: string;
  /** `null` · congé à cheval portant des jours de voyage, dont aucune date ne dit le mois. */
  joursDeConge: number | null;
  ouvrablesDuMois: number;
  moisDePaie: string;
  portePar: number | null;
}

/** Ce que l'employeur doit pour les jours de l'absence, tel que l'écran le dit. */
export const LIBELLE_REGIME: Record<RegimeRemuneration, string> = {
  DUE: 'Payée',
  DEUX_TIERS: 'Deux tiers',
  NON_DUE: 'Non payée',
  ARRETE_ABSENT: 'Non tranché',
};

/**
 * LES ÉLÉMENTS QUE LA PROPOSITION POSE AU BULLETIN, au clic · le salaire des
 * jours dus remplace le montant de la PREMIÈRE ligne de salaire (ou en crée
 * une), l'indemnité d'incapacité s'ajoute sous sa nature. Rien n'est posé
 * quand la proposition ne se chiffre pas.
 */
export function lignesProposees<L extends { nature: string; libelle: string; montantFc: string }>(
  lignes: readonly L[],
  p: PropositionDuMois,
  vierge: L,
  enChamp: (n: number) => string,
): L[] | null {
  if (p.salaireDesJoursDus === null) return null;
  const sortie = [...lignes];
  const i = sortie.findIndex((l) => l.nature === 'SALAIRE_OU_TRAITEMENT');
  const salaire = { ...(i >= 0 ? sortie[i] : vierge), nature: 'SALAIRE_OU_TRAITEMENT', montantFc: enChamp(p.salaireDesJoursDus) } as L;
  if (i >= 0) sortie[i] = salaire;
  else sortie.unshift({ ...salaire, libelle: salaire.libelle || 'Salaire des jours dus' } as L);
  if (p.joursDeuxTiers > 0) {
    if (p.indemniteDeuxTiers === null) return null;
    const j = sortie.findIndex((l) => l.nature === 'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT');
    const indemnite = {
      ...(j >= 0 ? sortie[j] : vierge),
      nature: 'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT',
      libelle: `Incapacité · ${p.joursDeuxTiers} jour(s) aux deux tiers`,
      montantFc: enChamp(p.indemniteDeuxTiers),
    } as L;
    if (j >= 0) sortie[j] = indemnite;
    else sortie.push(indemnite);
  }
  // Une ligne vide laissée par la saisie n'emporte rien · on la garde.
  return sortie;
}
