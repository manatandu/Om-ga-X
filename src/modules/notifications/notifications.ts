import { Logger } from '@nestjs/common';
import { LangueInterface, Prisma, RoleUtilisateur, TypeNotification } from '@prisma/client';

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

/**
 * LES LANGUES PROPOSÉES (fonction 96) · le français seul, pour l'instant, et
 * c'est le CONTRAT qui le dit, pas le code · son art. 3, troisième alinéa
 * (version 3 du 29 octobre 2026) écrit « L'interface d'OmegaX, ses documents
 * et le présent contrat sont en français, seule langue proposée ». Proposer
 * l'anglais rendrait cette phrase fausse ; une version publiée ne se réécrit
 * pas (contrat, art. 15), et une version nouvelle suit les délais du Code du
 * numérique, art. 34. Le mécanisme est posé (préférence, dictionnaire du
 * cadre, traduction au rendu) ; ouvrir l'anglais est une décision de
 * l'éditeur, qui publie la version qui le dit, puis ajoute « EN » ici.
 * Refusé ici aussi, pas seulement masqué à l'écran (CLAUDE.md, § 4).
 */
export const LANGUES_PROPOSEES: ReadonlyArray<LangueInterface> = [LangueInterface.FR];

export const MOTIF_LANGUE_NON_PROPOSEE =
  "Cette langue n'est pas proposée · le contrat de licence en vigueur dit l'interface en français, seule langue proposée (art. 3), et une autre langue ne s'ouvre qu'avec la version du contrat qui la dit.";

export const LIBELLE_TYPE_NOTIFICATION: Record<TypeNotification, string> = {
  MESSAGE_RECU: 'Message reçu',
  ECRITURES_RECUES: "Écritures reçues d'un autre dossier",
  EXERCICE_CLOTURE: 'Exercice clôturé',
};

/** Les notifications se lisent par tranches · au-delà, le total le dit. */
export const TAILLE_LISTE_NOTIFICATIONS = 50;
/** Une notification lue se retire après ce délai (Code du numérique, art. 193, 3°). */
export const CONSERVATION_LUES_JOURS = 90;

/** Les destinataires se lisent par tranches de cette taille. */
export const LOT_DESTINATAIRES = 500;

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
  // Par tranches, PAR LA CLÉ (`id` strictement après le dernier lu) · une
  // borne fixe taisait les destinataires au-delà, sans un mot.
  const destinataires: string[] = [];
  let apres: string | undefined;
  for (;;) {
    const lot = await db.user.findMany({
      where: {
        tenantId,
        estActif: true,
        ...(cible.userIds ? { id: { in: cible.userIds } } : {}),
        ...(cible.roles ? { role: { in: cible.roles } } : {}),
        ...(apres ? { AND: [{ id: { gt: apres } }] } : {}),
      },
      orderBy: { id: 'asc' },
      take: LOT_DESTINATAIRES,
      select: { id: true, preferences: { select: { notificationsCoupees: true } } },
    });
    for (const u of lot) {
      if (u.id !== cible.sauf && !(u.preferences?.notificationsCoupees ?? []).includes(type)) destinataires.push(u.id);
    }
    if (lot.length < LOT_DESTINATAIRES) break;
    apres = lot[lot.length - 1].id;
  }
  if (destinataires.length === 0) return 0;
  const titre = contenu.titre.slice(0, 250);
  const lien = contenu.lien ? contenu.lien.slice(0, 200) : null;
  await db.notificationUtilisateur.createMany({
    data: destinataires.map((destinataireId) => ({ tenantId, destinataireId, type, titre, lien })),
  });
  return destinataires.length;
}

const journal = new Logger('Notifications');

export type ContenuNotification = { titre: string; lien?: string | null };

/**
 * La même, appelée APRÈS l'acte · jamais levée. Un échec ne défait pas l'acte,
 * il se consigne (nom et code de l'erreur, jamais la chaîne de connexion).
 *
 * Le contenu peut se LIRE dans l'appel (une fonction) · la lecture qui le
 * compose (l'adresse de l'expéditeur, les bornes de l'exercice) tombe alors
 * sous la même garde. Lue avant, son échec rendait une erreur 500 sur un acte
 * pourtant fait (un message envoyé, un exercice clôturé), et l'utilisateur le
 * refaisait. Une fonction qui rend `null` ne notifie rien.
 */
export async function notifierSansEchec(
  db: Db,
  tenantId: string,
  type: TypeNotification,
  contenu: ContenuNotification | (() => Promise<ContenuNotification | null>),
  cible: CibleNotification,
): Promise<number> {
  try {
    const lu = typeof contenu === 'function' ? await contenu() : contenu;
    if (!lu) return 0;
    return await notifier(db, tenantId, type, lu, cible);
  } catch (e) {
    const code = (e as { code?: unknown })?.code;
    journal.warn(`Notification ${type} non posée (${(e as Error)?.name ?? 'erreur'}${typeof code === 'string' ? `, ${code}` : ''}).`);
    return 0;
  }
}
