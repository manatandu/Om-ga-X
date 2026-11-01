import type { Referentiel, RoleUtilisateur } from './types';

/**
 * L'ACCUEIL DU CABINET SUR SES DOSSIERS (ligne multi-dossiers, 2026-11-01).
 *
 * Une personne peut tenir plusieurs dossiers sous une seule adresse de
 * connexion. Le serveur ne sert que SES dossiers (`GET /auth/mes-dossiers`),
 * et changer de dossier est un geste (`POST /auth/changer-dossier`) · la
 * session se ferme et une neuve s'ouvre sur le dossier choisi. Après la
 * connexion, la liste s'affiche avant l'écran des logiciels ; ensuite, elle
 * se rappelle par Fichier > Changer de dossier.
 */
export interface DossierDeLaPersonne {
  dossierId: string;
  nom: string;
  referentiel: Referentiel;
  role: RoleUtilisateur;
  exercice: { dateDebut: string; dateFin: string } | null;
  courant: boolean;
  /** La licence du dossier · lecture seule (abonnement échu) ou fermée (suspendue, sans licence). */
  acces?: 'NORMAL' | 'LECTURE_SEULE' | 'FERME';
  motifAcces?: string | null;
}

/** La réponse de `GET /auth/mes-dossiers` · bornée, et elle le dit (§ 8 bis). */
export interface ListeDesDossiersDeLaPersonne {
  dossiers: DossierDeLaPersonne[];
  total: number;
  tronque: boolean;
  introuvables: number;
}

/** Une invitation reçue (`GET /auth/invitations`) · le jeton n'y est jamais, il est dans le courriel. */
export interface InvitationRecue {
  id: string;
  dossier: string;
  role: RoleUtilisateur;
  expireLe: string;
  /** Sur site, sans courriel · s'accepte depuis la session, sans code. */
  sansCode?: boolean;
}

export const LIBELLES_ACCES: Record<NonNullable<DossierDeLaPersonne['acces']>, string> = {
  NORMAL: 'Ouvert',
  LECTURE_SEULE: 'Lecture seule',
  FERME: 'Fermé',
};

const CLE_JETON = 'omegax.invitation.jeton';

/** Le jeton d'une invitation ouverte par son lien avant la connexion · repris par la liste des dossiers. */
export function garderJetonInvitation(jeton: string | null): void {
  try {
    if (jeton) sessionStorage.setItem(CLE_JETON, jeton);
    else sessionStorage.removeItem(CLE_JETON);
  } catch {
    /* stockage fermé · la personne recopiera le code du courriel */
  }
}

export function jetonInvitationGarde(): string {
  try {
    return sessionStorage.getItem(CLE_JETON) ?? '';
  } catch {
    return '';
  }
}

export const LIBELLES_ROLES_DOSSIER: Record<RoleUtilisateur, string> = {
  ADMIN_CABINET: 'Administrateur',
  COMPTABLE: 'Comptable',
  AIDE_COMPTABLE: 'Aide-comptable',
  GESTIONNAIRE_PAIE: 'Gestionnaire de paie',
  LECTURE_SEULE: 'Lecture seule',
};

/** La date d'un exercice, au jour, sans fuseau · « 31/12/2026 ». */
function jour(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

export function dateDuJour(iso: string): string {
  return jour(iso);
}

/** L'exercice ouvert le plus récent, dit · jamais « aucun » sur une valeur absente de la réponse. */
export function exerciceLu(e: DossierDeLaPersonne['exercice']): string {
  if (!e) return 'Aucun exercice ouvert';
  return `${jour(e.dateDebut)} au ${jour(e.dateFin)}`;
}

const CLE_CHOISI = 'omegax.dossier.choisi';

/**
 * La personne a-t-elle déjà choisi son dossier dans cette session de l'onglet ?
 * `sessionStorage` · une connexion nouvelle (ou un nouvel onglet) repose la
 * question. Fermé (fenêtre privée), la liste se montre, rien de plus.
 */
export function dossierChoisiDansLaSession(): boolean {
  try {
    return sessionStorage.getItem(CLE_CHOISI) === '1';
  } catch {
    return false;
  }
}

export function marquerDossierChoisi(): void {
  try {
    sessionStorage.setItem(CLE_CHOISI, '1');
  } catch {
    /* stockage fermé · la liste se remontrera, sans autre effet */
  }
}

export function oublierLeDossierChoisi(): void {
  try {
    sessionStorage.removeItem(CLE_CHOISI);
  } catch {
    /* rien à oublier */
  }
}
