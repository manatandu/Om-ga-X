/**
 * IMPRESSIONS DIFFÉRÉES (ligne sage-l7, fonction 59) · ce que la fenêtre dit
 * d'une demande, écrit une fois et tenu par son spec. Les règles vivent au
 * serveur (`src/modules/exports/impression-differee/`) · numéro, production
 * par le moteur de l'export, refus du plafond, interruption.
 */

export type NatureImpression = 'JOURNAL' | 'GRAND_LIVRE' | 'BALANCE';
export type EtatImpression = 'EN_ATTENTE' | 'EN_COURS' | 'PRETE' | 'ECHOUEE';

export interface ImpressionServie {
  id: string;
  numero: number;
  nature: NatureImpression;
  libelle: string;
  etat: EtatImpression;
  demandeLe: string;
  demandePar: string;
  commenceLe: string | null;
  produitLe: string | null;
  motifEchec: string | null;
  nomFichier: string | null;
  taille: number | null;
  empreinte: string | null;
  fichierRetireLe: string | null;
  /** En cours au-delà du délai · le processus qui la tenait est tombé. */
  interrompue: boolean;
}

export interface ListeImpressions {
  impressions: ImpressionServie[];
  total: number;
  tronque: boolean;
  enAttente: number;
}

export const LIBELLES_NATURE: Record<NatureImpression, string> = {
  JOURNAL: 'Journal',
  GRAND_LIVRE: 'Grand livre',
  BALANCE: 'Balance',
};

/** L'état, en clair · une production tombée se dit interrompue, jamais « en cours ». */
export function libelleEtat(i: Pick<ImpressionServie, 'etat' | 'interrompue' | 'fichierRetireLe'>): string {
  if (i.etat === 'EN_COURS') return i.interrompue ? 'Interrompue' : 'En cours';
  if (i.etat === 'EN_ATTENTE') return 'En attente';
  if (i.etat === 'ECHOUEE') return 'Échouée';
  return i.fichierRetireLe ? 'Prête · fichier retiré' : 'Prête';
}

/**
 * Il reste quelque chose à faire produire · une demande en attente, ou une
 * production tombée que le traitement déclarera échouée. La fenêtre relance
 * alors le traitement, et relit la liste tant qu'une production tourne.
 */
export function resteAProduire(liste: ListeImpressions): boolean {
  return liste.enAttente > 0 || liste.impressions.some((i) => i.etat === 'EN_COURS' && i.interrompue);
}

export function productionEnCours(liste: ListeImpressions): boolean {
  return liste.impressions.some((i) => i.etat === 'EN_ATTENTE' || (i.etat === 'EN_COURS' && !i.interrompue));
}

/** Les critères que la demande envoie, selon le livre · rien d'autre ne part. */
export function criteresDeLaDemande(
  nature: NatureImpression,
  champs: {
    exerciceId: string;
    journalId: string;
    dateDebut: string;
    dateFin: string;
    inclureBrouillard: boolean;
    format: 'fpm' | 'plat';
    grandsLivres: boolean;
  },
): Record<string, unknown> {
  if (nature === 'JOURNAL') {
    return {
      exerciceId: champs.exerciceId,
      ...(champs.journalId ? { journalId: champs.journalId } : {}),
      ...(champs.dateDebut ? { dateDebut: champs.dateDebut } : {}),
      ...(champs.dateFin ? { dateFin: champs.dateFin } : {}),
      inclureBrouillard: champs.inclureBrouillard,
    };
  }
  if (nature === 'GRAND_LIVRE') return { exerciceId: champs.exerciceId, format: champs.format };
  return { exerciceId: champs.exerciceId, grandsLivres: champs.grandsLivres };
}
