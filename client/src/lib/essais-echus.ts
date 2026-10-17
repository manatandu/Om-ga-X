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
  rappel: { misEnFileLe: string; envoyeLe: string | null; statutCourrier: string | null; erreur: string | null } | null;
  nombreUtilisateurs: number;
  nombreExercices: number;
  nombreEcritures: number;
}

export type IssueRappel = 'ENVOYE' | 'EN_FILE' | 'DEJA_ENVOYE' | 'EN_COURS' | 'SANS_ADMINISTRATEUR' | 'ECHEC' | 'NON_DU';

export interface ResultatRappel {
  tenantId: string;
  issue: IssueRappel;
  detail: string | null;
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
  if (e.rappel.envoyeLe) return { libelle: `parti le ${dateDuJour(e.rappel.envoyeLe.slice(0, 10))}`, alerte: false, detail: null };
  const echec = e.rappel.statutCourrier === 'ECHEC' || e.rappel.statutCourrier === 'ABANDONNE';
  return {
    libelle: echec ? 'en échec' : 'en file, pas parti',
    alerte: echec,
    detail: e.rappel.erreur,
  };
}
