/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · ce que l'écran des feuilles de temps lit
 * du serveur et envoie. Aucune règle de calcul ici · le compte des heures
 * supplémentaires, de nuit, du dimanche et des fériés est rejoué au serveur
 * (`personnel/feuilles-temps.ts`).
 */
import type { LigneHeures } from './heures-majorees';

export interface FeuilleLue {
  id: string;
  du: string;
  au: string;
  observation: string | null;
  heures: number;
  heuresNuit: number;
  annuleLe: string | null;
  motifAnnulation: string | null;
  creePar: string;
}

export interface ListeFeuilles {
  feuilles: FeuilleLue[];
  total: number;
  tronque: boolean;
}

export type NatureDuJour = 'OUVRABLE' | 'DIMANCHE' | 'FERIE' | 'CONGE_DU_FERIE_DU_DIMANCHE';

export interface JourDeLaFeuille {
  jour: string;
  nature: NatureDuJour;
  samedi: boolean;
  sousContrat: boolean;
  occupation: string | null;
  bulletinEmis: { numero: number; mois: string } | null;
  moisDePaiement: string;
  heures: number;
  heuresNuit: number;
  compteurs: { compteurId: string; heures: number }[];
}

export interface DetailFeuille {
  id: string;
  salarieId: string;
  du: string;
  au: string;
  observation: string | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  jours: JourDeLaFeuille[];
}

export interface CompteurLu {
  id: string;
  code: string;
  libelle: string;
  actif: boolean;
  desactiveLe: string | null;
}

export interface ListeCompteurs {
  compteurs: CompteurLu[];
  tronque: boolean;
}

export interface LigneProposee {
  nature: 'HEURES_SUPPLEMENTAIRES' | 'TRAVAIL_DE_NUIT' | 'TRAVAIL_REPOS_OU_FERIE';
  libelle: string;
  heures: number;
  minimum: boolean;
  samedi: boolean;
  majorationId: string | null;
  majorations: number;
}

export interface HeuresDuMois {
  mois: string;
  finDeService: string | null;
  semaines: {
    lundi: string;
    dimanche: string;
    heures: number;
    supplementairesDuJour: number;
    supplementairesDeLaSemaine: number | null;
    joursNonCouverts: string[];
  }[];
  totaux: { heures: number; supplementaires: number; supplementairesIncompletes: boolean; nuit: number; samedi: number; dimanche: number; ferie: number };
  lignes: LigneProposee[];
  compteurs: { compteurId: string; code: string; libelle: string; heures: number }[];
  bulletinEmis: { numero: number } | null;
}

/** Un nombre tapé à la française · « 7,5 », « 7.5 », espaces tolérés ; illisible, `null`. */
export function lireHeures(v: string): number | null {
  const t = v.replace(/\s/g, '').replace(',', '.');
  if (t === '') return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Une heure à l'écran · deux décimales au plus, la virgule française. */
export function heuresAffichees(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

/**
 * LES LIGNES QUI PARTENT À LA SIMULATION · la majoration présélectionnée
 * quand elle est seule, sinon laissée au choix ; le taux horaire jamais
 * deviné (le Code ne le fixe pas), les heures recopiées. Ajoutées à ce que le
 * cabinet a déjà tapé, jamais à sa place.
 */
export function lignesPourLaSimulation(proposees: readonly LigneProposee[], deja: readonly LigneHeures[]): LigneHeures[] {
  const vides = (l: LigneHeures) => !l.majorationId && !l.heures.trim() && !l.tauxHoraire.trim();
  return [
    ...deja.filter((l) => !vides(l)),
    ...proposees.map((p) => ({ majorationId: p.majorationId ?? '', heures: String(p.heures).replace('.', ','), tauxHoraire: '' })),
  ];
}

/** Ce qu'un jour dit en tête de ligne · le dimanche, le férié, le samedi. */
export function natureAffichee(j: Pick<JourDeLaFeuille, 'nature' | 'samedi'>): string {
  if (j.nature === 'DIMANCHE') return 'Dimanche';
  if (j.nature === 'FERIE') return 'Férié';
  if (j.nature === 'CONGE_DU_FERIE_DU_DIMANCHE') return 'Congé du férié';
  return j.samedi ? 'Samedi' : '';
}
