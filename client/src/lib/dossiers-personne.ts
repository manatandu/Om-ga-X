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
