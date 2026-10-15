/**
 * LIGNE SAGE-L5, FONCTION 79 · ce que l'écran des congés lit du serveur, et
 * les quelques aides de présentation. Aucune règle ici · le compteur, les
 * jours et l'allocation sont rejoués au serveur (`conges-acquis.ts`).
 */

export type StatutMois = 'ACQUIS' | 'REPRIS' | 'EN_COURS' | 'SANS_BULLETIN' | 'NON_ENTIER' | 'HORS_CONTRAT' | 'AGE_INCONNU';

export interface MoisDeService {
  du: string;
  au: string;
  statut: StatutMois;
  jours: number | null;
  motif: string | null;
}

export interface PeriodeDeConges {
  rang: number;
  du: string;
  au: string;
  etat: 'NEE' | 'EN_COURS' | 'REPRISE' | 'FIN_DE_SERVICE';
  mois: MoisDeService[];
  moisAcquis: number;
  joursDeBase: number | null;
  joursDAnciennete: number;
  joursAcquis: number | null;
}

export interface Compteur {
  periodes: PeriodeDeConges[];
  droitsNes: number | null;
  pris: number;
  solde: number | null;
  enCours: number | null;
  signaux: string[];
  congesAvantReprise: string[];
}

export interface AllocationLue {
  jours: number | null;
  ouvrables?: number;
  maladie?: number;
  montant: number | null;
  tauxJournalier: number | null;
  devise: string | null;
  motif: string | null;
}

export interface CongeLu {
  id: string;
  du: string;
  au: string;
  joursVoyage: number;
  moisDePaie: string;
  deviseAllocation: string | null;
  remunerationJournaliere: number | null;
  moyenneMensuelleArticle142: number | null;
  auDelaDuSolde: boolean;
  motifAuDelaDuSolde: string | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  bulletin: { numero: number; statut: 'EMIS' | 'ANNULE'; moisDePaie: string } | null;
  paiementAuPlusTard: string | null;
  allocation: AllocationLue;
}

export interface ReponseConges {
  aLa: string;
  compteur: Compteur | { refus: string };
  reprise: {
    arreteAu: string;
    joursNesNonPris: number;
    moisEnCoursAccomplis: number;
    source: string;
    declarePar: string;
  } | null;
  conges: CongeLu[];
  tronque: boolean;
}

/** Un congé dont le bulletin d'un mois peut porter l'allocation · servi à l'onglet Simulation. */
export interface CongeDuMois {
  id: string;
  du: string;
  au: string;
  /** Le numéro du bulletin actif qui la porte déjà, sinon null. */
  portePar: number | null;
  allocation: AllocationLue;
}

/** Pourquoi un congé du mois ne peut pas être porté par ce bulletin · null s'il le peut. */
export function motifCongeNonPortable(c: CongeDuMois, deviseBulletin: 'CDF' | 'USD'): string | null {
  if (c.portePar !== null) return `Déjà portée par le bulletin n° ${c.portePar}.`;
  if (c.allocation.montant === null) return c.allocation.motif ?? 'Allocation non chiffrée.';
  if (c.allocation.devise !== deviseBulletin) return `Allocation en ${c.allocation.devise ?? 'monnaie non renseignée'}, bulletin en ${deviseBulletin}.`;
  return null;
}

export interface Propositions {
  du: string;
  tauxJournalier: { valeur: number; devise: string; explication: string } | { valeur: null; motif: string };
  moyenneMensuelleArticle142: { valeur: number; explication: string } | { valeur: null; motif: string };
  paiementAuPlusTard: string | null;
}

/** Une durée en jours · une décimale au plus (le demi-jour du travailleur de moins de dix-huit ans). `null` n'est pas zéro. */
export function jours(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '·';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/** Un nombre saisi · espaces retirés, virgule admise ; vide ou illisible, absent (jamais zéro). */
export function lireNombre(v: string): number | undefined {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() === '' || Number.isNaN(n) ? undefined : n;
}

/** AAAA-MM-JJ en JJ/MM/AAAA · une date absente se dit « · ». */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '·';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Le mois de paie proposé pour un départ · celui du départ (art. 145, payée au départ). */
export function moisDuDepart(du: string): string {
  return /^\d{4}-\d{2}/.test(du) ? du.slice(0, 7) : '';
}

export const LIBELLE_STATUT_MOIS: Record<StatutMois, string> = {
  ACQUIS: 'Acquis',
  REPRIS: 'Couvert par la reprise',
  EN_COURS: 'En cours',
  SANS_BULLETIN: 'Sans bulletin',
  NON_ENTIER: 'Non entier',
  HORS_CONTRAT: 'Hors contrat',
  AGE_INCONNU: 'Âge non renseigné',
};

export const LIBELLE_ETAT_PERIODE: Record<PeriodeDeConges['etat'], string> = {
  NEE: 'Droit né',
  EN_COURS: "En cours d'acquisition",
  REPRISE: 'Couverte par la reprise',
  FIN_DE_SERVICE: 'Close par la fin du contrat',
};

/** L'état d'un congé, tel que l'écran le dit. */
export function etatConge(c: CongeLu): string {
  if (c.annuleLe) return 'Annulé';
  if (c.bulletin?.statut === 'EMIS') return `Payé au bulletin n° ${c.bulletin.numero}`;
  if (c.allocation.montant === null) return 'Allocation non chiffrée';
  return `À porter au bulletin de ${c.moisDePaie}`;
}
