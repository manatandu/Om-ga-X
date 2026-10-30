import { Logger } from '@nestjs/common';
import { Prisma, RoleUtilisateur, TypeNotification } from '@prisma/client';

/**
 * LES NOTIFICATIONS DANS L'INTERFACE (ligne dossier-l9, fonction 100 · Sage
 * X3, « workflow de notification »). Un événement du dossier se dit, dans le
 * logiciel seul, aux utilisateurs qu'il concerne · ni courriel, ni téléphone.
 * Trois événements, et chacun ses destinataires ·
 *
 *  · MESSAGE_RECU · les destinataires du message, et eux seuls · l'objet se
 *    dit au destinataire, qui le lit de toute façon (art. 193, 2°) ;
 *  · ECRITURES_RECUES · ceux qui valident (administrateur, comptable), sauf
 *    celui qui a reçu l'envoi · les pièces nées au brouillard attendent leur
 *    validation (AUDCIF art. 22, 2°) ;
 *  · EXERCICE_CLOTURE · tous les utilisateurs actifs, sauf celui qui a
 *    clôturé · l'exercice ne reçoit plus d'écriture.
 *
 * Chacun coupe les événements qu'il ne veut pas (ses préférences) · jamais
 * ceux d'un autre. Une notification ne retient rien et ne refuse rien · son
 * échec ne défait jamais l'acte qu'elle dit, il se CONSIGNE au journal du
 * serveur (`notifierSansEchec`).
 */

export const LIBELLE_TYPE_NOTIFICATION: Record<TypeNotification, string> = {
  MESSAGE_RECU: 'Message reçu',
  ECRITURES_RECUES: "Écritures reçues d'un autre dossier",
  EXERCICE_CLOTURE: 'Exercice clôturé',
};

/** Les notifications se lisent par tranches · au-delà, le total le dit. */
export const TAILLE_LISTE_NOTIFICATIONS = 50;
/** Une notification lue se retire après ce délai (Code du numérique, art. 193, 3°). */
export const CONSERVATION_LUES_JOURS = 90;

/** À qui l'événement se dit. */
export interface CibleNotification {
  /** Des utilisateurs nommés (les destinataires d'un message). */
  userIds?: string[];
  /** Ou les utilisateurs actifs de ces rôles · absent, tous les rôles. */
  roles?: RoleUtilisateur[];
  /** Celui qui a fait l'acte · il ne se notifie pas lui-même. */
  sauf?: string;
}

type Db = Pick<Prisma.TransactionClient, 'user' | 'notificationUtilisateur'>;

/**
 * POSE LES NOTIFICATIONS · aux utilisateurs ACTIFS du dossier que la cible
 * désigne, moins ceux qui ont coupé ce type d'événement. Rend le nombre posé.
 */
export async function notifier(
  db: Db,
  tenantId: string,
  type: TypeNotification,
  contenu: { titre: string; lien?: string | null },
  cible: CibleNotification,
): Promise<number> {
  const utilisateurs = await db.user.findMany({
    where: {
      tenantId,
      estActif: true,
      ...(cible.userIds ? { id: { in: cible.userIds } } : {}),
      ...(cible.roles ? { role: { in: cible.roles } } : {}),
    },
    take: 1000,
    select: { id: true, preferences: { select: { notificationsCoupees: true } } },
  });
  const destinataires = utilisateurs
    .filter((u) => u.id !== cible.sauf)
    .filter((u) => !(u.preferences?.notificationsCoupees ?? []).includes(type))
    .map((u) => u.id);
  if (destinataires.length === 0) return 0;
  const titre = contenu.titre.slice(0, 250);
  const lien = contenu.lien ? contenu.lien.slice(0, 200) : null;
  await db.notificationUtilisateur.createMany({
    data: destinataires.map((destinataireId) => ({ tenantId, destinataireId, type, titre, lien })),
  });
  return destinataires.length;
}

const journal = new Logger('Notifications');

/**
 * La même, appelée APRÈS l'acte · jamais levée. Un échec ne défait pas l'acte,
 * il se consigne (nom et code de l'erreur, jamais la chaîne de connexion).
 */
export async function notifierSansEchec(
  db: Db,
  tenantId: string,
  type: TypeNotification,
  contenu: { titre: string; lien?: string | null },
  cible: CibleNotification,
): Promise<number> {
  try {
    return await notifier(db, tenantId, type, contenu, cible);
  } catch (e) {
    const code = (e as { code?: unknown })?.code;
    journal.warn(`Notification ${type} non posée (${(e as Error)?.name ?? 'erreur'}${typeof code === 'string' ? `, ${code}` : ''}).`);
    return 0;
  }
}
