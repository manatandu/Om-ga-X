import { createHash } from 'crypto';
import { DUREE_MAXIMALE_SESSION_LONGUE_S } from './session-longue';

/**
 * « SE DÉCONNECTER » FERME LA SESSION SUR LE SERVEUR (relevé de sécurité du
 * 2026-10-23) · la déconnexion n'effaçait que le cookie du navigateur, et le
 * jeton restait valable jusqu'à son échéance, huit heures, trente jours pour
 * « Rester connecté ». Une copie du cookie prise avant (poste partagé, extension
 * de navigateur, sauvegarde du profil) ouvrait encore le dossier après la
 * déconnexion · sondé sur une instance jetable, 200 sur `/auth/me` après
 * `/auth/logout`. OWASP ASVS 5.0, exigence 7.4.1 (la déconnexion invalide la
 * session côté serveur).
 *
 * POURQUOI PAS `sessionsInvalidesAvant` · il ferme TOUTES les sessions du
 * compte, et se déconnecter du poste du bureau fermerait aussi le téléphone.
 * La session se reconnaît à son jeton CSRF, tiré à la connexion et recopié par
 * chaque prolongation et chaque réémission (`emettreSession`) · c'est
 * l'identifiant d'une session, pas d'un jeton. On en garde l'EMPREINTE, jamais
 * le jeton lui-même, qui reste un secret de la session.
 *
 * Module pur · aucune base, aucune horloge lue ici.
 */

/** Une session fermée · empreinte de son jeton CSRF et fin de sa vie possible, en secondes. */
export interface SessionFermee {
  e: string;
  f: number;
}

/**
 * Au-delà, la liste ne grandit plus · le compte se ferme en entier
 * (`sessionsInvalidesAvant`), ce qui couvre toutes les sessions d'avant, et la
 * liste repart vide. Une session vit au plus trente jours · cent déconnexions
 * en trente jours, c'est trois par jour.
 */
export const PLAFOND_SESSIONS_FERMEES = 100;

export function empreinteSession(csrf: string): string {
  return createHash('sha256').update(csrf, 'utf8').digest('hex').slice(0, 32);
}

/**
 * Jusqu'à quand garder la trace · la vie la plus longue qu'une session née à
 * `origine` peut atteindre, trente jours, quelle que soit l'échéance du jeton
 * présenté à la déconnexion. Une copie volée d'une session longue se prolonge
 * à l'usage · gardée jusqu'à la seule échéance du jeton présenté, la trace
 * tombait et la copie, prolongée entre-temps, revenait.
 */
export function finDeVie(origine: number, exp: number | undefined): number {
  return Math.max(exp ?? 0, origine + DUREE_MAXIMALE_SESSION_LONGUE_S);
}

/** Lit la colonne JSON telle qu'elle vient de la base · une valeur illisible ne ferme rien, ne casse rien. */
export function lireSessionsFermees(brut: unknown): SessionFermee[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter(
    (x): x is SessionFermee =>
      !!x && typeof x === 'object' && typeof (x as SessionFermee).e === 'string' && typeof (x as SessionFermee).f === 'number',
  );
}

/** Vrai si la session de ce jeton CSRF a été fermée et n'a pas encore fini sa vie. */
export function estSessionFermee(brut: unknown, csrf: string | undefined, maintenantS: number): boolean {
  if (!csrf) return false;
  const e = empreinteSession(csrf);
  return lireSessionsFermees(brut).some((s) => s.e === e && s.f > maintenantS);
}

/**
 * Ajoute une session fermée · les traces échues tombent, un doublon n'est pas
 * réécrit. `debordement` vrai · la liste dépasserait le plafond, l'appelant
 * ferme alors tout le compte et pose `liste` (vide).
 */
export function ajouterSessionFermee(
  brut: unknown,
  nouvelle: SessionFermee,
  maintenantS: number,
): { liste: SessionFermee[]; debordement: boolean } {
  const vivantes = lireSessionsFermees(brut).filter((s) => s.f > maintenantS && s.e !== nouvelle.e);
  if (vivantes.length + 1 > PLAFOND_SESSIONS_FERMEES) return { liste: [], debordement: true };
  return { liste: [...vivantes, nouvelle], debordement: false };
}
