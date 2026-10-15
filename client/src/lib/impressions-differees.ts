import { statutDe } from './message-refus';

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
  /** Le numéro à partir duquel la liste se poursuit vers les plus anciennes, ou rien (relecture m5). */
  plusAnciensAvant: number | null;
  enAttente: number;
}

/** La page suivante ajoutée à la liste lue, sans doublon. */
export function poursuivreImpressions(liste: ListeImpressions, suite: ListeImpressions): ListeImpressions {
  const vues = new Set(liste.impressions.map((i) => i.id));
  return {
    ...suite,
    impressions: [...liste.impressions, ...suite.impressions.filter((i) => !vues.has(i.id))],
    tronque: suite.plusAnciensAvant !== null,
  };
}

/**
 * La première page relue (la fenêtre la relit pendant une production) GARDE
 * les plus anciennes déjà chargées · sans quoi chaque relecture repliait la
 * liste sur ses cinquante premières.
 */
export function garderLesPlusAnciennes(avant: ListeImpressions | null, premiere: ListeImpressions): ListeImpressions {
  if (!avant || premiere.plusAnciensAvant === null) return premiere;
  const borne = premiere.plusAnciensAvant;
  const anciennes = avant.impressions.filter((i) => i.numero < borne);
  if (anciennes.length === 0) return premiere;
  return {
    ...premiere,
    impressions: [...premiere.impressions, ...anciennes],
    tronque: avant.plusAnciensAvant !== null,
    plusAnciensAvant: avant.plusAnciensAvant,
  };
}

/**
 * UNE LICENCE ÉCHUE NE PRODUIT PLUS D'IMPRESSION DIFFÉRÉE (relecture m10 ;
 * décision de Manasse du 2026-10-09 · un dossier échu passe en lecture seule,
 * GET et HEAD) · demander et faire produire s'écrivent, et le serveur les
 * refuse. L'export DIRECT des livres, servi en lecture, reste ouvert · la
 * fenêtre le dit à côté du refus.
 */
export function messageLicenceEchue(e: unknown): string | null {
  if (statutDe(e) !== 403 || !(e instanceof Error) || !/lecture seule/i.test(e.message)) return null;
  return (
    "Une licence échue ne produit plus d'impression différée · téléchargez le livre directement depuis sa " +
    "fenêtre (Journal, Grand livre, Balance), dont l'export reste ouvert en lecture."
  );
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

/**
 * Une production tourne ou attend · la fenêtre relit alors la liste. Lue sur
 * la PREMIÈRE PAGE relue seulement (relecture des écrans, second tour, 1) ·
 * les pages plus anciennes ne se relisent pas, et une demande qu'elles
 * montraient encore « En attente » faisait relire la liste sans fin.
 */
export function productionEnCours(liste: ListeImpressions): boolean {
  return liste.impressions.some((i) => i.etat === 'EN_ATTENTE' || (i.etat === 'EN_COURS' && !i.interrompue));
}

/**
 * FAIRE PRODUIRE, OU SEULEMENT RELIRE (relecture des écrans, second tour, 1).
 * Le traitement ne se relance que s'il reste à produire, qu'AUCUNE production
 * ne tourne déjà (un autre poste, ou le serveur qui finit après un 504 · il
 * en produit une à la fois par dossier, la relance n'aurait rien fait que
 * l'occuper) et que la relance n'est pas SUSPENDUE · un refus nommé (licence
 * échue, droit) la suspend jusqu'au prochain geste, sans quoi le même refus
 * repartait toutes les quatre secondes.
 */
export function doitFaireProduire(premiere: ListeImpressions, suspendue: boolean): boolean {
  if (suspendue) return false;
  if (premiere.impressions.some((i) => i.etat === 'EN_COURS' && !i.interrompue)) return false;
  return resteAProduire(premiere);
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
