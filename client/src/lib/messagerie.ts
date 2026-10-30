/**
 * MESSAGERIE INTERNE ET UTILISATEURS CONNECTÉS, côté écran (ligne dossier-l9,
 * fonction 95, src/modules/messagerie/). Types servis et aides de lecture ·
 * aucune règle ici.
 */
import type { RoleUtilisateur } from './types';

export const LIBELLE_ROLE_COURT: Record<RoleUtilisateur, string> = {
  ADMIN_CABINET: 'Administrateur',
  COMPTABLE: 'Comptable',
  LECTURE_SEULE: 'Lecture seule',
  AIDE_COMPTABLE: 'Aide-comptable',
  GESTIONNAIRE_PAIE: 'Gestionnaire de paie',
};

export interface SessionConnectee {
  id: string;
  userId: string;
  email: string;
  role: RoleUtilisateur;
  ouverteLe: string;
  derniereActiviteLe: string;
  sessionLongue: boolean;
  appareil: string | null;
  connectee: boolean;
}

export interface ListeConnectes {
  sessions: SessionConnectee[];
  total: number;
  tronque: boolean;
  connectees: number;
  delaiConnecteMinutes: number;
  fenetreHeures: number;
}

export interface MessageRecu {
  id: string;
  objet: string;
  envoyeLe: string;
  de: string;
  lu: boolean;
}

export interface MessageEnvoye {
  id: string;
  objet: string;
  envoyeLe: string;
  a: string[];
  lusPar: number;
}

export interface BoiteRecus {
  messages: MessageRecu[];
  total: number;
  nonLus: number;
  tronque: boolean;
}

export interface BoiteEnvoyes {
  messages: MessageEnvoye[];
  total: number;
  tronque: boolean;
}

export interface MessageLu {
  id: string;
  objet: string;
  corps: string;
  envoyeLe: string;
  de: string;
  deId: string;
  a: Array<{ email: string; id: string; lu?: boolean }>;
  repondA: { id: string; objet: string } | null;
  estExpediteur: boolean;
}

export interface Destinataire {
  id: string;
  email: string;
  role: RoleUtilisateur;
}

/** « Connecté », ou depuis combien de temps la session est inactive. */
export function etatDeLaSession(s: Pick<SessionConnectee, 'connectee' | 'derniereActiviteLe'>, maintenant: Date): string {
  if (s.connectee) return 'Connecté';
  const minutes = Math.max(0, Math.round((maintenant.getTime() - new Date(s.derniereActiviteLe).getTime()) / 60000));
  if (minutes < 60) return `Inactif depuis ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  return `Inactif depuis ${heures} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** L'objet d'une réponse · « Re : » une fois, jamais empilé. */
export function objetDeLaReponse(objet: string): string {
  return /^re\s*:/i.test(objet.trim()) ? objet.trim() : `Re : ${objet.trim()}`.slice(0, 150);
}
