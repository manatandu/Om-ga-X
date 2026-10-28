/**
 * LIGNE SAGE-L4, N° 73 · le transfert d'un bien entre deux dossiers du groupe,
 * vu de l'écran. Les règles sont au serveur (`transfert-groupe.ts`) · l'écran
 * ne fait que proposer les choix évidents et dire le refus tel qu'il revient.
 */

export interface DossierDuContexte {
  id: string;
  nom: string;
  siege: boolean;
  exercicesOuverts: Array<{ id: string; dateDebut: string; dateFin: string }>;
  journaux: Array<{ id: string; code: string; intitule: string }>;
  comptesLiaison: Array<{ id: string; numero: string; intitule: string }>;
}

export interface ContexteTransfert {
  siegeId: string;
  referentiel: string;
  dossiers: DossierDuContexte[];
}

export interface BienTransferable {
  id: string;
  designation: string;
  numeroInventaire: string | null;
  compte: string;
  valeurOrigine: number;
  dateAcquisition: string;
}

export interface MontantsTransfert {
  valeurOrigine: number;
  amortissements: number;
  complementDotation: number;
  depreciations: number;
  valeurNette: number;
}

export interface TransfertListe {
  transfertId: string;
  designation: string;
  dossierCedant: string;
  dossierReceveur: string;
  date: string;
  referencePiece: string;
  valeurOrigine: number;
  amortissements: number;
  depreciations: number;
  valeurNette: number;
  annuleLe: string | null;
  motifAnnulation: string | null;
}

/**
 * Le journal proposé · le seul journal d'opérations diverses du dossier, ou
 * celui dont le code est OD quand il y en a plusieurs, sinon aucun (le cabinet
 * choisit). Jamais un journal deviné parmi plusieurs autres.
 */
export function journalPropose(d: DossierDuContexte | undefined): string {
  if (!d) return '';
  if (d.journaux.length === 1) return d.journaux[0].id;
  return d.journaux.find((j) => j.code === 'OD')?.id ?? '';
}

/** Le compte de liaison proposé · le seul ouvert, sinon aucun. */
export function liaisonProposee(d: DossierDuContexte | undefined): string {
  if (!d || d.comptesLiaison.length !== 1) return '';
  return d.comptesLiaison[0].id;
}

/**
 * Les dossiers qui peuvent recevoir le bien d'un dossier qui cède · la fiche
 * du compte 18 relie le siège à chaque établissement, jamais deux
 * établissements entre eux (le serveur le refuse aussi).
 */
export function receveursPossibles(dossiers: DossierDuContexte[], cedantId: string): DossierDuContexte[] {
  const cedant = dossiers.find((d) => d.id === cedantId);
  if (!cedant) return [];
  return dossiers.filter((d) => d.id !== cedantId && (cedant.siege || d.siege));
}

/**
 * Le dossier qui reçoit, présélectionné quand il n'y en a qu'un · une cellule
 * qui cède n'a qu'un receveur possible, le siège. Rejoué à CHAQUE changement
 * du dossier qui cède, sans quoi la cellule choisie en second laissait le
 * receveur vide alors qu'un seul choix existe.
 */
export function receveurPreselectionne(dossiers: DossierDuContexte[], cedantId: string): string {
  const r = receveursPossibles(dossiers, cedantId);
  return r.length === 1 ? r[0].id : '';
}

/**
 * La clé d'un aperçu · le corps exact envoyé. Une réponse dont la clé n'est
 * plus celle du formulaire est PÉRIMÉE (un champ a changé pendant la lecture)
 * et se jette, sans quoi le bouton « Transférer » passerait un transfert que
 * l'écran n'a jamais montré.
 */
export function cleApercu(corps: Record<string, string>): string {
  return JSON.stringify(Object.keys(corps).sort().map((k) => [k, corps[k]]));
}
