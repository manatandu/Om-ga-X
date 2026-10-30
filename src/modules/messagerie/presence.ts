import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { empreinteSession, lireSessionsFermees } from '../auth/sessions-fermees';

/**
 * LES UTILISATEURS CONNECTÉS (ligne dossier-l9, fonction 95 · Sage, « liste
 * des utilisateurs connectés au fichier »). Les règles pures et l'écriture
 * de la présence, sans service · `JwtStrategy` l'appelle à chaque requête
 * admise.
 *
 * DÉCISIONS PAR LA LOI (Code du numérique, ordonnance-loi n° 23/10 du 13 mars
 * 2023).
 *
 *  · NON EXCESSIVES · art. 194, « les données à caractère personnel
 *    collectées doivent être fiables, adéquates, pertinentes, exactes,
 *    intègres et non excessives ». La fenêtre sert à l'administrateur à voir
 *    qui travaille dans le dossier, sur quel appareil, et à fermer une
 *    session · il lui faut l'utilisateur, l'ouverture, la dernière activité et
 *    un appareil RÉSUMÉ (« Chrome · Windows »). Ni l'adresse IP, ni la chaîne
 *    complète du navigateur (une empreinte de l'appareil), ni les adresses
 *    visitées ne sont gardées.
 *
 *  · CONSERVÉES LE TEMPS DE LA FINALITÉ · art. 193, 3°, « pendant une durée
 *    n'excédant pas celle nécessaire à la réalisation des finalités ». Une
 *    session vit au plus trente jours (`session-longue.ts`) · une présence
 *    se retire trente et un jours après sa dernière activité, à la lecture de
 *    la fenêtre.
 *
 *  · JAMAIS DE JETON · la session se nomme par l'empreinte de son jeton CSRF
 *    (`empreinteSession`, celle que la déconnexion ferme), qui ne sort jamais
 *    du serveur · l'écran reçoit un identifiant de ligne, rien qui ouvre une
 *    session.
 */

/** En deçà, la session est « connectée » · convention d'OmegaX, dite à l'écran. */
export const DELAI_CONNECTE_MS = 15 * 60 * 1000;
/** Au plus une écriture par session et par minute · une requête n'en coûte pas une. */
export const RYTHME_ECRITURE_MS = 60 * 1000;
/** Au-delà, la présence se retire (art. 193, 3°). */
export const CONSERVATION_JOURS = 31;

/** L'appareil résumé · navigateur et système, jamais la chaîne complète. */
export function resumeAppareil(userAgent: string | undefined | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const navigateur = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const systeme = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (!navigateur && !systeme) return 'Autre appareil';
  return [navigateur ?? 'Navigateur', systeme].filter(Boolean).join(' · ');
}

/** Ce que la base dit d'une session vue, et de son titulaire. */
export interface PresenceLue {
  empreinteSession: string;
  ouverteLe: Date;
  authentifieeLe: Date;
  derniereActiviteLe: Date;
  fermeeLe: Date | null;
  user: { estActif: boolean; sessionsInvalidesAvant: Date | null; sessionsFermees: unknown };
}

/**
 * LA SESSION EST-ELLE ENCORE OUVERTE ? · ni déconnectée de cet appareil
 * (trace ou liste des sessions fermées), ni révoquée par une fermeture de
 * toutes les sessions du compte postérieure à sa dernière authentification
 * (celle que `JwtStrategy` compare · un changement de mot de passe réémet la
 * session et la garde ouverte), ni portée par un compte désactivé.
 */
export function sessionEncoreOuverte(p: PresenceLue, maintenant: Date): boolean {
  if (p.fermeeLe || !p.user.estActif) return false;
  const maintenantS = Math.floor(maintenant.getTime() / 1000);
  if (lireSessionsFermees(p.user.sessionsFermees).some((s) => s.e === p.empreinteSession && s.f > maintenantS)) return false;
  // La révocation se compare à la seconde, comme `sessionRevoquee` (jwt.strategy.ts).
  if (p.user.sessionsInvalidesAvant && Math.floor(p.authentifieeLe.getTime() / 1000) < Math.floor(p.user.sessionsInvalidesAvant.getTime() / 1000)) {
    return false;
  }
  return true;
}

export function estConnectee(derniereActiviteLe: Date, maintenant: Date): boolean {
  return maintenant.getTime() - derniereActiviteLe.getTime() <= DELAI_CONNECTE_MS;
}

/** Ce que l'écriture de la présence lit de la requête admise. */
export interface PresenceAEcrire {
  tenantId: string;
  userId: string;
  csrf: string | null;
  origineS: number;
  /** La dernière authentification explicite, en secondes. */
  authentificationS: number;
  longue: boolean;
  userAgent: string | undefined;
}

type ClientPresence = { presenceSession: Pick<Prisma.TransactionClient['presenceSession'], 'updateMany' | 'create'> };

const journal = new Logger('Presence');
/** La dernière écriture de chaque session, sur cette instance · borne la mémoire à son plafond. */
const derniereEcriture = new Map<string, number>();
const PLAFOND_MEMOIRE = 10_000;

/**
 * NOTE LA PRÉSENCE · au plus une fois par minute et par session. Jamais
 * bloquante, jamais levée · une présence non écrite ne coûte qu'une ligne de
 * moins dans la fenêtre, et l'échec se CONSIGNE au journal du serveur (nom et
 * code, jamais la chaîne de connexion).
 */
export function noterPresence(prisma: ClientPresence, p: PresenceAEcrire, maintenantMs = Date.now()): Promise<void> | null {
  if (!p.csrf) return null;
  const empreinte = empreinteSession(p.csrf);
  const avant = derniereEcriture.get(empreinte);
  if (avant !== undefined && maintenantMs - avant < RYTHME_ECRITURE_MS) return null;
  if (derniereEcriture.size >= PLAFOND_MEMOIRE) derniereEcriture.clear();
  derniereEcriture.set(empreinte, maintenantMs);
  const maintenant = new Date(maintenantMs);
  const appareil = resumeAppareil(p.userAgent);
  return (async () => {
    const fait = await prisma.presenceSession.updateMany({
      where: { tenantId: p.tenantId, empreinteSession: empreinte, userId: p.userId },
      data: { derniereActiviteLe: maintenant, authentifieeLe: new Date(p.authentificationS * 1000), appareil },
    });
    if (fait.count === 0) {
      await prisma.presenceSession.create({
        data: {
          tenantId: p.tenantId,
          userId: p.userId,
          empreinteSession: empreinte,
          ouverteLe: new Date(p.origineS * 1000),
          authentifieeLe: new Date(p.authentificationS * 1000),
          derniereActiviteLe: maintenant,
          sessionLongue: p.longue,
          appareil,
        },
      });
    }
  })().catch((e: unknown) => {
    // Une seconde requête de la même session a pu créer la ligne entre-temps (P2002) · rien à dire.
    const code = (e as { code?: unknown })?.code;
    if (code === 'P2002') return;
    derniereEcriture.delete(empreinte);
    journal.warn(`Présence non écrite (${(e as Error)?.name ?? 'erreur'}${typeof code === 'string' ? `, ${code}` : ''}).`);
  });
}

/** Pour les specs · vide la mémoire du rythme. */
export function oublierLeRythme(): void {
  derniereEcriture.clear();
}
