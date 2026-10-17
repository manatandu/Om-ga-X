import { jourDeKinshasa } from '../../../common/echeance';
import { estUnDossierDEssai } from '../../auth/inscription-essai';

/**
 * LE SORT D'UN DOSSIER D'ESSAI NON SOUSCRIT · moteur PUR, ni base ni horloge
 * (décision de Manasse du 2026-10-17).
 *
 * Un dossier d'essai (licence ABONNEMENT de trente jours, née de l'inscription
 * en libre-service) qui n'a pas été souscrit reste CONSULTABLE ET EXPORTABLE en
 * lecture seule pendant CENT QUATRE-VINGTS JOURS après son terme, puis il est
 * SUPPRIMÉ. Un courriel de rappel part à l'administrateur au moins TRENTE
 * jours avant la suppression, et lui dit qu'il peut tout exporter avant.
 *
 * CENT QUATRE-VINGTS JOURS, PAS « SIX MOIS » · six mois calendaires font 181 à
 * 184 jours selon la date, et la promesse faite au client doit se compter
 * pareil pour tous. Un nombre de JOURS, au jour de Kinshasa (`jourDeKinshasa`,
 * la convention du dépôt pour toute date d'obligation).
 *
 * LA SUPPRESSION EST UN GESTE DE L'OPÉRATEUR, JAMAIS UNE TÂCHE PLANIFIÉE ·
 * Cloud Run n'a pas de planificateur dans ce dépôt, et un effacement
 * irréversible gagne à rester une décision humaine, prise devant la liste. Ce
 * module dit seulement ce que le calendrier PERMET.
 *
 * EN CAS DE DOUTE, NON CONCERNÉ. Un `null` n'est pas un feu vert : une licence
 * illisible, un dossier qui touche à un groupe, à la vitrine, à l'éditeur ou à
 * un abonnement, une origine qu'on ne retrouve pas, et le dossier n'est jamais
 * proposé à la suppression.
 */

/** Conservation après le terme · cent quatre-vingts JOURS, décision du 2026-10-17. */
export const JOURS_CONSERVATION_ESSAI = 180;

/** Préavis minimal entre l'envoi du rappel et la suppression, en jours. */
export const JOURS_RAPPEL_AVANT_SUPPRESSION = 30;

/**
 * La fenêtre où l'opérateur envoie le rappel · du soixantième au trentième jour
 * avant la première date de suppression. CONVENTION D'OMEGAX, aucun texte ne la
 * fixe : elle laisse un mois de marge à un geste manuel, et empêche de rappeler
 * trop tôt un client dont l'échéance est encore lointaine.
 */
export const JOURS_FENETRE_RAPPEL = 30;

export type EtatEssai = 'EN_COURS' | 'ECHU_CONSERVE' | 'RAPPEL_A_ENVOYER' | 'SUPPRIMABLE' | 'NON_CONCERNE';

export interface FaitsDossierEssai {
  licence: { type: string; statut: string; dateDebut: Date; dateExpiration: Date | null } | null;
  /** Le dossier de la vitrine (`Tenant.estDemonstration`). */
  estDemonstration: boolean;
  /** Mère d'un groupe, cellule d'un groupe, ou dossier de combinaison. */
  toucheUnGroupe: boolean;
  /** Un abonnement est enregistré à son nom (`AbonnementCabinet`), donc des factures en puissance ou émises. */
  aUnAbonnement: boolean;
  /** Le courriel de l'inscription en libre-service est retrouvé dans la file du dossier. */
  inscritParEssai: boolean;
  /** Le rappel, quand il a été mis en file · `envoyeLe` seulement une fois PARTI. */
  rappel: { envoyeLe: Date | null } | null;
}

export interface VerdictEssai {
  etat: EtatEssai;
  /** Pourquoi le dossier n'est pas concerné · null pour les autres états. */
  motif: string | null;
  /** Le jour du terme de l'essai (jour de Kinshasa). */
  termeLe: Date | null;
  /** Dernier jour de conservation, inclus · terme + 180. */
  conserveJusquAu: Date | null;
  /** Premier jour où la suppression est permise, rappel compris. */
  supprimableLe: Date | null;
  /** Premier jour où le rappel peut partir. */
  rappelDepuisLe: Date | null;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Un jour (minuit UTC) plus n jours · le calendrier UTC n'a ni heure d'été ni saut. */
export function ajouterJours(jour: Date, n: number): Date {
  return new Date(jour.getTime() + n * JOUR_MS);
}

/** Nombre de jours entiers de `a` à `b`, deux jours à minuit UTC. */
export function joursEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / JOUR_MS);
}

/** Premier jour où le dossier peut être supprimé, SANS tenir compte du rappel. */
export function premiereDateDeSuppression(termeLe: Date): Date {
  // Conservé JUSQU'AU terme + 180 inclus · supprimable le lendemain. Jamais le
  // jour même, qui ferait 179 jours pleins de conservation.
  return ajouterJours(termeLe, JOURS_CONSERVATION_ESSAI + 1);
}

/**
 * Le jour où la suppression est permise une fois le rappel parti `envoyeLe` · ni
 * avant la conservation, ni avant trente jours pleins après l'envoi. Un rappel
 * parti tard repousse la suppression, il ne raccourcit jamais le préavis.
 */
export function dateDeSuppression(termeLe: Date, envoyeLe: Date | null): Date {
  const premiere = premiereDateDeSuppression(termeLe);
  if (!envoyeLe) return premiere;
  const apresPreavis = ajouterJours(jourDeKinshasa(envoyeLe), JOURS_RAPPEL_AVANT_SUPPRESSION);
  return apresPreavis.getTime() > premiere.getTime() ? apresPreavis : premiere;
}

const SANS_DATES = { termeLe: null, conserveJusquAu: null, supprimableLe: null, rappelDepuisLe: null };

function nonConcerne(motif: string): VerdictEssai {
  return { etat: 'NON_CONCERNE', motif, ...SANS_DATES };
}

export function etatDeLEssai(faits: FaitsDossierEssai, maintenant: Date): VerdictEssai {
  const l = faits.licence;
  if (!l) return nonConcerne('Aucune licence lisible.');
  if (l.type === 'PROPRIETAIRE') return nonConcerne('Dossier de l’éditeur.');
  if (faits.estDemonstration) return nonConcerne('Dossier de démonstration.');
  if (faits.toucheUnGroupe) return nonConcerne('Dossier mère ou cellule d’un groupe.');
  if (faits.aUnAbonnement) return nonConcerne('Un abonnement est enregistré pour ce dossier.');
  if (l.statut === 'SUSPENDUE') return nonConcerne('Licence suspendue par l’éditeur.');
  // Licence d'essai EXACTE · abonnement de trente jours, ni prolongé ni raccourci
  // (un abonnement souscrit ou prolongé par un paiement n'a plus cette durée).
  if (!estUnDossierDEssai(l)) return nonConcerne('La licence n’est pas celle d’un essai de trente jours.');
  // Un dossier de la console qui aurait par hasard une licence de trente jours
  // ne naît pas de l'inscription en libre-service · sans le courriel de cette
  // porte, rien ne prouve que son titulaire a reçu l'avertissement.
  if (!faits.inscritParEssai) return nonConcerne('Le dossier ne vient pas de l’inscription en libre-service.');

  const echeance = l.dateExpiration as Date; // estUnDossierDEssai l'exige non nulle
  const termeLe = jourDeKinshasa(echeance);
  const conserveJusquAu = ajouterJours(termeLe, JOURS_CONSERVATION_ESSAI);
  const premiere = premiereDateDeSuppression(termeLe);
  const rappelDepuisLe = ajouterJours(premiere, -(JOURS_RAPPEL_AVANT_SUPPRESSION + JOURS_FENETRE_RAPPEL));
  const dates = { termeLe, conserveJusquAu, rappelDepuisLe };

  // L'essai court tant que l'instant d'échéance n'est pas atteint · le jour du
  // terme, avant l'heure, il est encore en cours.
  if (maintenant.getTime() < echeance.getTime()) {
    return { etat: 'EN_COURS', motif: null, supprimableLe: null, ...dates };
  }

  const aujourdhui = jourDeKinshasa(maintenant);
  const envoyeLe = faits.rappel?.envoyeLe ?? null;
  const supprimableLe = dateDeSuppression(termeLe, envoyeLe);

  if (envoyeLe) {
    const permis = aujourdhui.getTime() >= supprimableLe.getTime();
    return { etat: permis ? 'SUPPRIMABLE' : 'ECHU_CONSERVE', motif: null, supprimableLe, ...dates };
  }
  const rappelDu = aujourdhui.getTime() >= rappelDepuisLe.getTime();
  return { etat: rappelDu ? 'RAPPEL_A_ENVOYER' : 'ECHU_CONSERVE', motif: null, supprimableLe, ...dates };
}
