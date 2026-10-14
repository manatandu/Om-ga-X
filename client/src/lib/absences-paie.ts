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
}

export interface PropositionDuMois {
  joursDeuxTiers: number;
  joursNonDus: number;
  joursNonTranches: number;
  joursPayesAPlein: number | null;
  salaireDesJoursDus: number | null;
  indemniteDeuxTiers: number | null;
  motifs: string[];
  explication: string | null;
}

export interface AbsencesDuMois {
  mois: string;
  devise: string | null;
  salaireMensuel: number | null;
  absences: { id: string; nature: string; libelle: string; du: string; au: string; joursDuMois: number; regimes: RegimeRemuneration[] }[];
  proposition: PropositionDuMois;
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
