/**
 * LES PRÉFÉRENCES ET LES NOTIFICATIONS DE CHACUN, côté écran (ligne
 * dossier-l9, fonctions 96 et 100, src/modules/notifications/). Types servis
 * et aides de lecture · aucune règle ici, le serveur les tient.
 */
import type { LangueInterface } from './traduction';

export type TypeNotification = 'MESSAGE_RECU' | 'ECRITURES_RECUES' | 'EXERCICE_CLOTURE';

export interface Preferences {
  langue: LangueInterface;
  notificationsCoupees: TypeNotification[];
  /**
   * Les langues que le serveur PROPOSE · le français seul tant que le contrat
   * de licence le dit (src/modules/notifications/notifications.ts,
   * `LANGUES_PROPOSEES`). L'écran n'offre que celles-ci.
   */
  languesProposees: LangueInterface[];
  /** Les événements qui notifient, avec leur libellé · servis, jamais recopiés ici. */
  types: Array<{ type: TypeNotification; libelle: string }>;
}

export interface NotificationLue {
  id: string;
  type: TypeNotification;
  titre: string;
  lien: string | null;
  creeeLe: string;
  lueLe: string | null;
}

export interface ListeNotifications {
  notifications: NotificationLue[];
  total: number;
  nonLues: number;
  tronque: boolean;
}

/** L'évènement qui fait relire le compte des notifications non lues (après une lecture). */
export const EVENEMENT_NOTIFICATIONS = 'omegax:notifications';

/**
 * Le libellé du bouton du cadre · un compte non lu (null) ne se dit jamais
 * « aucune » · c'est la réponse favorable à la question que la pastille pose
 * (CLAUDE.md, § 9 ter, « null n'est pas vide »).
 */
export function titreNotifications(nonLues: number | null): string {
  if (nonLues === null) return 'Notifications · le nombre de non lues n’a pas pu être lu';
  if (nonLues === 0) return 'Notifications · aucune non lue';
  return `Notifications · ${nonLues} non lue${nonLues > 1 ? 's' : ''}`;
}

/** La pastille · rien à zéro ou inconnu, « 99+ » au-delà. */
export function pastilleNotifications(nonLues: number | null): string | null {
  if (nonLues === null || nonLues <= 0) return null;
  return nonLues > 99 ? '99+' : String(nonLues);
}
