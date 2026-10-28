/**
 * LES DOSSIERS D'ESSAI ÉCHUS, côté écran (console de l'éditeur · décision de
 * Manasse du 2026-10-17). Des types et des libellés · le calendrier, lui, vit
 * au serveur (`plateforme/essais-echus/essais-echus.ts`) et c'est lui qui juge ;
 * l'écran ne recalcule JAMAIS une date, il montre celles qu'il a lues.
 */
export type EtatEssaiEchu = 'ECHU_CONSERVE' | 'RAPPEL_A_ENVOYER' | 'SUPPRIMABLE';

export interface EssaiEchu {
  tenantId: string;
  etat: EtatEssaiEchu;
  termeLe: string | null;
  conserveJusquAu: string | null;
  supprimableLe: string | null;
  rappelDepuisLe: string | null;
  /**
   * `causeEchec` est une CATÉGORIE servie par le serveur, jamais le texte de
   * l'erreur du transport (il cite l'adresse du client, que l'éditeur ne voit pas).
   */
  rappel: { misEnFileLe: string; envoyeLe: string | null; statutCourrier: string | null; causeEchec: string | null } | null;
  nombreUtilisateurs: number;
  nombreExercices: number;
  nombreEcritures: number;
}

export type IssueRappel = 'ENVOYE' | 'EN_FILE' | 'DEJA_ENVOYE' | 'EN_COURS' | 'SANS_ADMINISTRATEUR' | 'ECHEC' | 'NON_DU';

export interface ResultatRappel {
  tenantId: string;
  issue: IssueRappel;
  detail: string | null;
  cause?: string | null;
}

/** Les catégories d'un échec d'envoi, servies par le serveur (`cause-echec-envoi.ts`) · une inconnue se dit telle quelle. */
const CAUSES: Record<string, string> = {
  REFUS_DESTINATAIRE: 'adresse refusée par le serveur du destinataire',
  AUTHENTIFICATION: 'authentification de la messagerie refusée',
  RESEAU: 'serveur de messagerie injoignable',
  AUTRE: 'autre cause',
};

export function libelleCauseEchec(cause: string | null | undefined): string | null {
  if (!cause) return null;
  return CAUSES[cause] ?? cause;
}

const ETATS: Record<EtatEssaiEchu, { libelle: string; classe: string }> = {
  ECHU_CONSERVE: { libelle: 'CONSERVÉ', classe: 'text-text-dim bg-surface-alt' },
  RAPPEL_A_ENVOYER: { libelle: 'RAPPEL À ENVOYER', classe: 'text-warning bg-warning-soft' },
  SUPPRIMABLE: { libelle: 'SUPPRIMABLE', classe: 'text-danger bg-danger-soft' },
};

/** Un état inconnu de cette version de l'écran se dit tel quel, il ne disparaît pas. */
export function etatEssai(etat: string): { libelle: string; classe: string } {
  return (ETATS as Record<string, { libelle: string; classe: string }>)[etat] ?? { libelle: etat, classe: 'text-text-dim bg-surface-alt' };
}

const ISSUES: Record<IssueRappel, string> = {
  ENVOYE: 'rappel parti',
  EN_FILE: 'en file, pas encore parti',
  DEJA_ENVOYE: 'déjà parti',
  EN_COURS: 'envoi déjà en cours',
  SANS_ADMINISTRATEUR: 'aucun administrateur actif',
  ECHEC: 'échec',
  NON_DU: 'pas encore dû',
};

export function libelleIssueRappel(issue: string): string {
  return (ISSUES as Record<string, string>)[issue] ?? issue;
}

/** Un jour AAAA-MM-JJ rendu JJ/MM/AAAA, sans passer par le fuseau du poste · « · » quand il manque, jamais une date inventée. */
export function dateDuJour(iso: string | null): string {
  if (!iso) return '·';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '·';
}

/**
 * Le JOUR de Kinshasa (UTC+1, sans heure d'été) d'un instant ISO, écrit
 * AAAA-MM-JJ · la règle du serveur (`common/echeance.ts`), qui compte le préavis
 * sur ce jour-là. Lu au jour UTC, un rappel parti entre minuit et une heure à
 * Kinshasa s'affichait la veille, et l'écran contredisait la date de suppression
 * que le serveur en tire. `null` sur un instant illisible, jamais une date inventée.
 */
export function jourDeKinshasa(instant: string | null): string | null {
  if (!instant) return null;
  const t = Date.parse(instant);
  if (Number.isNaN(t)) return null;
  return new Date(t + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Le rappel d'un dossier, pour la colonne · un rappel mis en file n'est PAS un
 * rappel parti (le serveur ne laisse supprimer que sur un message constaté
 * envoyé), et un échec d'envoi se montre en alerte.
 */
export function statutDuRappel(e: EssaiEchu): { libelle: string; alerte: boolean; detail: string | null } {
  if (!e.rappel) {
    return e.etat === 'RAPPEL_A_ENVOYER'
      ? { libelle: 'à envoyer', alerte: false, detail: null }
      : { libelle: `dû dès le ${dateDuJour(e.rappelDepuisLe)}`, alerte: false, detail: null };
  }
  if (e.rappel.envoyeLe) return { libelle: `parti le ${dateDuJour(jourDeKinshasa(e.rappel.envoyeLe))}`, alerte: false, detail: null };
  const echec = e.rappel.statutCourrier === 'ECHEC' || e.rappel.statutCourrier === 'ABANDONNE';
  return {
    libelle: echec ? 'en échec' : 'en file, pas parti',
    alerte: echec,
    detail: libelleCauseEchec(e.rappel.causeEchec),
  };
}
