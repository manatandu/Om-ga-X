/**
 * RENUMÉROTATION ET MAINTENANCE DU REGISTRE (ligne sage-l4, fonction n° 73) ·
 * les formes servies par le serveur et la requête de l'aperçu, hors du
 * composant pour se tester.
 */

export interface ParametresRenumerotation {
  prefixe: string;
  /** Saisi · le serveur le lit en entier et refuse l'illisible. */
  premierNumero: string;
  largeur: string;
  ordre: 'ACQUISITION' | 'COMPTE';
  perimetre: 'EN_SERVICE' | 'SANS_NUMERO';
}

/** Les biens sans numéro d'abord · renuméroter tout le parc est un choix, jamais un défaut. */
export const PARAMETRES_INITIAUX: ParametresRenumerotation = {
  prefixe: 'IMM-',
  premierNumero: '1',
  largeur: '4',
  ordre: 'ACQUISITION',
  perimetre: 'SANS_NUMERO',
};

export interface ApercuRenumerotation {
  nombre: number;
  aChanger: number;
  attributions: { id: string; designation: string; ancien: string | null; nouveau: string }[];
  tronque: boolean;
  motifRefus: string | null;
}

interface LigneRapprochement {
  numero: string;
  intitule: string;
  registre: number;
  balance: number;
  ecart: number;
}

export interface MaintenanceLue {
  exercice: { id: string; dateFin: string };
  comptesBien: (LigneRapprochement & { lignesSansFiche: { nombre: number; montant: number } })[];
  comptesAmortissement: LigneRapprochement[];
  dotationsAPasser: { nombre: number; montant: number };
  reclassesApresLaCloture: { designation: string; date: string; ancienCompte: string; compteActuel: string }[];
  reclassesApresLaClotureTotal: number;
  numerosEnDouble: { numero: string; fiches: { id: string; designation: string }[] }[];
  numerosEnDoubleTotal: number;
  biensEnServiceSansNumero: number;
  /** Ligne Microfina M4 · biens sortis du registre encore détenus par un salarié. */
  biensSortisEncoreDetenus?: { id: string; designation: string; numeroInventaire: string | null; dateSortie: string | null }[];
  biensSortisEncoreDetenusTotal?: number;
  /** Relecture m3 · détentions en cours dont le détenteur n'a plus de contrat en cours (nombre seul, sans nom). */
  detentionsSansContratEnCours?: number;
  /** Relecture m2 · détentions dont le bien est sorti avant la remise. */
  detentionsSortiesAvantLaRemise?: number;
}

/** La requête de l'aperçu · chaque paramètre encodé, le préfixe compris (« / » et « . » y sont admis). */
export function requeteRenumerotation(p: ParametresRenumerotation): string {
  return new URLSearchParams({
    prefixe: p.prefixe,
    premierNumero: p.premierNumero.trim(),
    largeur: p.largeur.trim(),
    ordre: p.ordre,
    perimetre: p.perimetre,
  }).toString();
}
