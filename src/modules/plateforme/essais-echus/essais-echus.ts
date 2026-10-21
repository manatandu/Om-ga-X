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
  /**
   * Le rappel, quand il a été mis en file · `envoyeLe` seulement une fois PARTI ;
   * `termeLe`, le terme qu'il annonçait (absent dans les jeux d'essai purs, qui
   * n'en connaissent qu'un). Le rappel d'un AUTRE terme est ignoré.
   */
  rappel: { envoyeLe: Date | null; termeLe?: Date | null } | null;
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
 * avant la conservation, ni avant trente jours PLEINS après le jour de l'envoi.
 * Un rappel parti tard repousse la suppression, il ne raccourcit jamais le préavis.
 *
 * TRENTE JOURS PLEINS, LE JOUR DE L'ENVOI NON COMPTÉ · même règle que la
 * conservation (`premiereDateDeSuppression`, terme + 180 inclus, supprimable le
 * lendemain). Compter le jour de l'envoi pour un jour de préavis faisait d'un
 * rappel parti le jour D à 23 h 59 un dossier supprimable à D + 30, 0 h 01 · vingt-
 * neuf jours pleins et deux minutes, quand le courriel promettait « au moins
 * trente jours ». D'où le `+ 1` · supprimable à D + 31, le courriel annonçant
 * cette date exacte.
 */
export function dateDeSuppression(termeLe: Date, envoyeLe: Date | null): Date {
  const premiere = premiereDateDeSuppression(termeLe);
  if (!envoyeLe) return premiere;
  const apresPreavis = ajouterJours(jourDeKinshasa(envoyeLe), JOURS_RAPPEL_AVANT_SUPPRESSION + 1);
  return apresPreavis.getTime() > premiere.getTime() ? apresPreavis : premiere;
}

/**
 * UN RAPPEL ANCIEN NE VAUT PAS PRÉAVIS POUR UN TERME NOUVEAU · l'opérateur peut
 * redonner un essai (nouvelle licence de trente jours, terme T2). Le rappel parti
 * pour le terme T1 annonçait une autre date à un client qui a depuis repris
 * l'essai · le lire comme préavis de T2 rendrait le dossier supprimable sans que
 * personne ne l'ait prévenu de la nouvelle échéance. Deux signes, chacun
 * suffisant · le terme que le rappel porte n'est pas le terme courant, ou le
 * rappel est parti AVANT l'ouverture de la fenêtre de rappel du terme courant
 * (aucun rappel de T2 ne peut partir avant elle). Ignoré, il laisse l'état
 * repasser par RAPPEL_A_ENVOYER.
 */
export function rappelDuTermeCourant(
  rappel: FaitsDossierEssai['rappel'],
  termeLe: Date,
  rappelDepuisLe: Date,
): boolean {
  if (!rappel) return false;
  if (rappel.termeLe && jourUtcDe(rappel.termeLe).getTime() !== termeLe.getTime()) return false;
  if (rappel.envoyeLe && jourDeKinshasa(rappel.envoyeLe).getTime() < rappelDepuisLe.getTime()) return false;
  return true;
}

/** Une `@db.Date` lue de la base est déjà à minuit UTC · ramenée à elle-même, sans fuseau. */
const jourUtcDe = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Le jour (de Kinshasa) du terme d'une licence d'essai · la clé de son rappel. */
export function termeDeLaLicence(dateExpiration: Date): Date {
  return jourDeKinshasa(dateExpiration);
}

/** Premier jour où le rappel du terme `termeLe` peut partir. */
export function debutDeLaFenetreDeRappel(termeLe: Date): Date {
  return ajouterJours(premiereDateDeSuppression(termeLe), -(JOURS_RAPPEL_AVANT_SUPPRESSION + JOURS_FENETRE_RAPPEL));
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
  const termeLe = termeDeLaLicence(echeance);
  const conserveJusquAu = ajouterJours(termeLe, JOURS_CONSERVATION_ESSAI);
  const rappelDepuisLe = debutDeLaFenetreDeRappel(termeLe);
  const dates = { termeLe, conserveJusquAu, rappelDepuisLe };

  // L'essai court tant que l'instant d'échéance n'est pas atteint · le jour du
  // terme, avant l'heure, il est encore en cours.
  if (maintenant.getTime() < echeance.getTime()) {
    return { etat: 'EN_COURS', motif: null, supprimableLe: null, ...dates };
  }

  const aujourdhui = jourDeKinshasa(maintenant);
  const rappel = rappelDuTermeCourant(faits.rappel, termeLe, rappelDepuisLe) ? faits.rappel : null;
  const envoyeLe = rappel?.envoyeLe ?? null;
  const supprimableLe = dateDeSuppression(termeLe, envoyeLe);

  if (envoyeLe) {
    const permis = aujourdhui.getTime() >= supprimableLe.getTime();
    return { etat: permis ? 'SUPPRIMABLE' : 'ECHU_CONSERVE', motif: null, supprimableLe, ...dates };
  }
  const rappelDu = aujourdhui.getTime() >= rappelDepuisLe.getTime();
  return { etat: rappelDu ? 'RAPPEL_A_ENVOYER' : 'ECHU_CONSERVE', motif: null, supprimableLe, ...dates };
}
