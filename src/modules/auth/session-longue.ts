import { randomBytes } from 'crypto';
import type { JwtService } from '@nestjs/jwt';

/**
 * « RESTER CONNECTÉ SUR CET APPAREIL » (audit final F270, décision de Manasse
 * du 2026-09-27). Deux régimes de session, et c'est ce fichier qui dit leurs
 * durées, jamais un écran ni un contrôleur.
 *
 * COURTE, par défaut, case décochée · le cookie est un cookie DE SESSION, sans
 * `maxAge` ni `expires`, fermé avec le navigateur, et le jeton vit la durée du
 * module (JWT_EXPIRES_IN, huit heures). Avant F270, toute session durait huit
 * heures ET survivait à la fermeture du navigateur, y compris sur un poste
 * partagé · le suivant qui ouvrait le navigateur trouvait le dossier ouvert.
 *
 * LONGUE, case cochée · trente jours au plus depuis la connexion d'ORIGINE, et
 * sept jours sans utilisation. Chaque usage prolonge, sans jamais dépasser les
 * trente jours · le jeton porte donc son origine (`origine`, en secondes), et
 * toute réémission la recopie au lieu de la repousser. Une session qui se
 * prolongerait en repartant de la dernière réémission vivrait indéfiniment
 * pour qui s'en sert une fois par semaine.
 *
 * LA CONSOLE DE L'ÉDITEUR EXIGE UNE AUTHENTIFICATION RÉCENTE · un opérateur
 * de la plateforme tient les licences et les administrateurs de tous les
 * cabinets. Il reste connecté sur son appareil comme tout utilisateur
 * (décision de Manasse du 2026-10-09, « Long, console redemandée »), mais la
 * console n'admet qu'une authentification de moins de huit heures
 * (`authentificationTropAnciennePourLaConsole`, relue par
 * `OperateurPlateformeGuard` à chaque requête), jamais seulement à l'écran.
 */

export const SECONDES_PAR_JOUR = 86_400;

/** Trente jours au plus depuis la connexion d'origine. */
export const DUREE_MAXIMALE_SESSION_LONGUE_S = 30 * SECONDES_PAR_JOUR;

/** Sept jours sans utilisation · au-delà, la session longue est fermée. */
export const DUREE_INACTIVITE_SESSION_LONGUE_S = 7 * SECONDES_PAR_JOUR;

/**
 * UNE PROLONGATION PAR JOUR AU PLUS, et c'est une convention d'OmegaX. Réémettre
 * à chaque requête changerait le cookie sur chaque appel (des dizaines par
 * écran) pour ne rien gagner. Le prix est dit · un jeton prolongé vaut sept
 * jours depuis sa réémission, et la réémission n'a lieu qu'une fois par jour,
 * si bien que l'inactivité tolérée va de six à sept jours, JAMAIS plus de sept.
 * Le sens retenu est celui de la sécurité · la borne annoncée est un plafond.
 */
export const INTERVALLE_PROLONGATION_S = SECONDES_PAR_JOUR;

/**
 * LA CONSOLE DE L'ÉDITEUR EXIGE UNE AUTHENTIFICATION RÉCENTE (décision de
 * Manasse du 2026-10-09, « Long, console redemandée ») · l'opérateur peut
 * rester connecté sur son appareil comme tout utilisateur, mais la console,
 * qui rouvre et coupe les licences et réinitialise l'administrateur de
 * n'importe quel cabinet, n'admet qu'une session dont la dernière
 * authentification EXPLICITE (mot de passe, et code s'il est actif) date de
 * moins de huit heures. Une session longue volée n'en donne donc pas les
 * clés. Huit heures · la durée d'une session courte (`JWT_EXPIRES_IN`),
 * convention d'OmegaX, égale à la durée par défaut d'une session courte.
 * Jusqu'au 2026-10-09, la console refusait toute session longue (audit final
 * F270), et la case ne faisait rien pour l'opérateur.
 */
export const DELAI_CONSOLE_DEPUIS_AUTHENTIFICATION_S = 8 * 3600;

export const MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE =
  "La console de l'éditeur demande une connexion de moins de huit heures · reconnectez-vous avec votre mot de passe et votre code.";

/**
 * Vrai quand la dernière CONNEXION COMPLÈTE (mot de passe, et code s'il est
 * actif) est inconnue ou trop ancienne pour la console. Jamais
 * `authentification` · un changement de mot de passe, d'adresse ou « Déconnecter
 * mes autres appareils » ne demandent que le mot de passe et la renouvellent ;
 * lue par la console, elle rouvrait huit heures sans le code à qui tenait un
 * cookie volé et le mot de passe (relecture du 2026-10-09).
 */
export function authentificationTropAnciennePourLaConsole(session: SessionEnCours | null, maintenantS: number): boolean {
  const c = session?.connexionComplete;
  // Ce qui ne se lit pas comme un instant est trop ancien · une comparaison
  // avec NaN rendrait faux, et la console s'ouvrirait.
  return !(typeof c === 'number' && Number.isFinite(c) && maintenantS - c <= DELAI_CONSOLE_DEPUIS_AUTHENTIFICATION_S);
}

/** Ce que le jeton porte de sa session. */
export interface ChargeJeton {
  sub: string;
  /** Jeton CSRF apparié · absent des jetons émis avant la migration cookie. */
  csrf?: string;
  /** Émission et échéance, en SECONDES depuis l'époque · posées par jsonwebtoken. */
  iat?: number;
  exp?: number;
  /** « Rester connecté » · absent ou faux : session courte. */
  longue?: boolean;
  /** Connexion d'origine, en secondes · absente des jetons d'avant F270. */
  origine?: number;
  /**
   * Dernière authentification EXPLICITE, en secondes · la connexion, ou la
   * réémission qui suit un acte présentant le mot de passe ou le code. C'est
   * ELLE, et non l'émission, que la révocation lit (`JwtStrategy`), et la
   * prolongation la RECOPIE (audit final F270, relecture adverse). Sans elle,
   * un jeton prolongé dans la même seconde qu'une révocation portait une
   * émission que la comparaison à la seconde ne tient pas pour antérieure · il
   * échappait à la révocation, puis se prolongeait jusqu'aux trente jours,
   * sans mot de passe. Absente des jetons d'avant, l'émission en tient lieu.
   */
  authentification?: number;
  /**
   * Dernière CONNEXION COMPLÈTE, en secondes · mot de passe ET second facteur
   * s'il est actif (la connexion, l'activation et le retrait de la double
   * authentification). Les réémissions qui ne demandent que le mot de passe et
   * la prolongation la RECOPIENT. C'est elle, et elle seule, que la console lit
   * (`authentificationTropAnciennePourLaConsole`). Absente (jeton d'avant le
   * 2026-10-09), la console redemande la connexion · jamais l'émission en lieu.
   */
  connexionComplete?: number;
}

/** La session d'une requête, lue dans son jeton par `JwtStrategy`. */
export interface SessionEnCours {
  longue: boolean;
  origine: number;
  iat: number | null;
  exp: number | null;
  csrf: string | null;
  /** Voir `ChargeJeton.authentification` · la prolongation la recopie. */
  authentification?: number | null;
  /** Voir `ChargeJeton.connexionComplete` · nulle quand le jeton ne la porte pas. */
  connexionComplete?: number | null;
}

export function sessionDuJeton(charge: ChargeJeton, instantS: number): SessionEnCours {
  return {
    longue: charge.longue === true,
    // Un jeton d'avant F270 ne porte pas son origine · son émission en tient
    // lieu, c'est la date la plus ancienne qu'il prouve.
    origine: charge.origine ?? charge.iat ?? instantS,
    iat: charge.iat ?? null,
    exp: charge.exp ?? null,
    csrf: charge.csrf ?? null,
    authentification: charge.authentification ?? charge.iat ?? null,
    connexionComplete: charge.connexionComplete ?? null,
  };
}

/** Échéance d'un jeton long émis à `instantS` · sept jours, bornés aux trente de l'origine. */
export function echeanceSessionLongue(origine: number, instantS: number): number {
  return Math.min(instantS + DUREE_INACTIVITE_SESSION_LONGUE_S, origine + DUREE_MAXIMALE_SESSION_LONGUE_S);
}

/**
 * La session doit-elle être prolongée à cette requête ? Longue, émise depuis
 * au moins un jour, et la prolongation RECULE réellement l'échéance · passé le
 * vingt-troisième jour, l'échéance est déjà la borne des trente jours et une
 * réémission ne changerait rien.
 */
export function prolongationDue(session: SessionEnCours, instantS: number): boolean {
  if (!session.longue || session.iat === null) return false;
  if (instantS - session.iat < INTERVALLE_PROLONGATION_S) return false;
  return echeanceSessionLongue(session.origine, instantS) > (session.exp ?? 0);
}

export interface DemandeSession {
  longue: boolean;
  /** Connexion d'origine à RECOPIER · absente, la session naît à cet instant. */
  origine?: number;
  /**
   * Échéance à GARDER pour une session courte réémise (changement de mot de
   * passe, autres appareils déconnectés) · une réémission ne doit pas rendre
   * huit heures neuves à une session qui en a déjà vécu sept. Absente, la
   * durée du module (JWT_EXPIRES_IN).
   */
  expCourte?: number | null;
  /**
   * Jeton CSRF à RECOPIER · la prolongation le garde, sans quoi la session
   * survivrait et le jeton CSRF que tient l'écran mourrait avec l'ancien
   * cookie · chaque écriture suivante serait refusée en 403.
   */
  csrf?: string | null;
  /**
   * Dernière authentification explicite à RECOPIER · la prolongation seule la
   * passe. Absente, la session est authentifiée à cet instant (connexion,
   * réémission après un acte), ce qui lui fait passer sa propre révocation.
   */
  authentification?: number | null;
  /**
   * Connexion complète · `'maintenant'` pour un acte qui a présenté le mot de
   * passe ET le code s'il est actif (la connexion, l'activation et le retrait
   * de la double authentification), une date à RECOPIER sinon. Absente, le
   * jeton n'en porte pas, et la console redemandera la connexion.
   */
  connexionComplete?: 'maintenant' | number | null;
}

export interface SessionEmise {
  accessToken: string;
  csrfToken: string;
  sessionLongue: boolean;
  /** Durée du cookie · `null` pour un cookie de session, fermé avec le navigateur. */
  maxAgeMs: number | null;
}

/**
 * ÉMET LE JETON D'UNE SESSION · la seule écriture de la charge et de la durée,
 * appelée par la connexion, par les réémissions d'`AuthService` et par la
 * prolongation de `JwtStrategy`. Deux écritures auraient divergé au premier
 * correctif, et c'est l'origine qu'on oublie de recopier.
 *
 * L'ÉMISSION EST POSÉE DANS LA CHARGE (`iat`) · jsonwebtoken compte alors
 * l'échéance depuis elle, si bien que la borne des trente jours tombe à la
 * seconde et non à la seconde suivante. Et c'est l'instant fourni, pas
 * l'horloge du moment de la signature · la réémission qui suit une révocation
 * (`sessionsInvalidesAvant`) porte ainsi une authentification que la
 * comparaison à la seconde de `sessionRevoquee` ne tient pas pour antérieure.
 * La prolongation, elle, recopie l'authentification du jeton qu'elle remplace ·
 * elle n'est pas un acte, et une révocation qui a frappé l'ancien jeton
 * frappe le nouveau.
 */
export function emettreSession(
  jwt: Pick<JwtService, 'sign'>,
  userId: string,
  demande: DemandeSession,
  instantMs = Date.now(),
): SessionEmise {
  const instantS = Math.floor(instantMs / 1000);
  const origine = demande.origine ?? instantS;
  const csrfToken = demande.csrf ?? randomBytes(16).toString('hex');
  const authentification = demande.authentification ?? instantS;
  const connexionComplete = demande.connexionComplete === 'maintenant' ? instantS : (demande.connexionComplete ?? undefined);
  const charge: ChargeJeton = {
    sub: userId,
    csrf: csrfToken,
    origine,
    authentification,
    ...(connexionComplete !== undefined ? { connexionComplete } : {}),
    iat: instantS,
  };
  if (demande.longue) {
    const duree = Math.max(1, echeanceSessionLongue(origine, instantS) - instantS);
    return {
      accessToken: jwt.sign({ ...charge, longue: true }, { expiresIn: duree }),
      csrfToken,
      sessionLongue: true,
      maxAgeMs: duree * 1000,
    };
  }
  const garder = demande.expCourte ? { expiresIn: Math.max(1, demande.expCourte - instantS) } : undefined;
  return { accessToken: jwt.sign(charge, garder), csrfToken, sessionLongue: false, maxAgeMs: null };
}

/**
 * LA SESSION DE LA REQUÊTE · posée par `JwtStrategy.validate` à côté de
 * `request.user`, et non dans lui · `AuthenticatedUser` décrit QUI appelle,
 * ceci dit PAR QUELLE SESSION, et seuls le contrôleur d'authentification et
 * `JwtAuthGuard` en ont l'usage.
 */
export const CLE_SESSION_REQUETE = 'sessionOmegax';

export interface SessionDeRequete extends SessionEnCours {
  /** Jeton prolongé, que `JwtAuthGuard` pose en cookie une fois la requête admise. */
  prolongation?: { accessToken: string; maxAgeMs: number };
}

export function sessionDeLaRequete(requete: unknown): SessionDeRequete | null {
  const s = (requete as Record<string, unknown> | null | undefined)?.[CLE_SESSION_REQUETE];
  return (s as SessionDeRequete | undefined) ?? null;
}

/**
 * Ce qu'une réémission garde de la session en cours · son régime, son origine
 * et, courte, son échéance. Sans session connue (appel direct au service), une
 * session courte neuve, comme avant F270.
 */
export function demandeDeReemission(session: SessionEnCours | null): DemandeSession {
  if (!session) return { longue: false };
  // La connexion complète se RECOPIE · la réémission suit un acte qui n'a
  // présenté que le mot de passe, sauf quand l'appelant dit le contraire.
  const connexionComplete = session.connexionComplete ?? null;
  return session.longue
    ? { longue: true, origine: session.origine, connexionComplete }
    : { longue: false, origine: session.origine, expCourte: session.exp, connexionComplete };
}
