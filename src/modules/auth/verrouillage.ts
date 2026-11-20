/**
 * VERROUILLAGE PAR COMPTE.
 *
 * Le limiteur global (ThrottlerGuard) est par ADRESSE IP · il ne voit pas une
 * attaque lancée depuis vingt adresses contre UN seul compte, qui est
 * exactement la forme que prend une attaque réelle par liste de mots de passe.
 *
 * LA CONTREPARTIE, et c'est elle qui décide de la forme : un verrou DÉFINITIF
 * se retourne en refus de service. Il suffirait de saisir n'importe quoi cinq
 * fois sur l'adresse d'un comptable pour l'empêcher de travailler, et l'adresse
 * d'un comptable n'est pas un secret · elle figure sur ses courriels. Le verrou
 * est donc TEMPORAIRE et croissant, dans la forme que NIST SP 800-63B-4
 * (section « Rate Limiting (Throttling) ») donne en exemple, un délai qui
 * augmente « from 30 seconds up to an hour » · ici 1, 5, 15, 30 puis 60
 * minutes à partir du cinquième échec consécutif.
 *
 * CE QUE LE CODE FAIT, ET QU'IL NE FAISAIT PAS JUSQU'AU 2026-09-28. Le
 * compteur repartait de zéro dès que le verrou précédent était échu. Un
 * attaquant qui attendait la fin de chaque verrou ne dépassait donc jamais le
 * palier d'une minute (cinq essais par minute, environ sept mille par jour et
 * par compte), et la croissance annoncée ne jouait JAMAIS contre lui · elle ne
 * frappait que le titulaire assez pressé pour réessayer pendant le verrou,
 * essai qui n'est d'ailleurs pas compté. Le compteur ne se remet plus à zéro
 * à l'échéance du verrou. Il tombe dans trois cas, et trois seulement :
 *  · une connexion RÉUSSIE · NIST SP 800-63B-4, même section, « when the
 *    subscriber successfully authenticates, the verifier SHOULD disregard
 *    any previous failed attempts » ;
 *  · un mot de passe CHANGÉ ou RÉINITIALISÉ, et le déverrouillage par
 *    l'administrateur · celui qui les pose a prouvé qui il est ou en répond ;
 *  · le DÉLAI D'OUBLI, douze heures sans aucun échec, compté depuis le
 *    DERNIER échec (`User.dernierEchecLe`). C'est la valeur par défaut du
 *    « Failure Reset Time » de Keycloak (documentation « Brute force
 *    detection »), dont la même documentation exige qu'il dépasse le verrou
 *    le plus long · sinon le compteur s'oublie avant que le dernier palier
 *    ne soit jamais atteint, et le plafond est une promesse vide. Sans ce
 *    délai, une faute de frappe six mois plus tard hériterait de la sévérité
 *    d'un incident oublié ; avec lui, l'attaquant patient paie le palier
 *    d'une heure dès le neuvième échec, soit une trentaine d'essais par
 *    jour et par compte au lieu de sept mille.
 */

export const SEUIL_VERROUILLAGE = 5;

/** Paliers du verrou, en minutes, du cinquième échec consécutif au plafond. */
export const PALIERS_VERROU_MINUTES = [1, 5, 15, 30, 60] as const;

/**
 * DÉLAI D'OUBLI, en heures · compté depuis le dernier échec. Doit dépasser le
 * palier le plus long (verrouillage.spec.ts le tient), sans quoi le plafond
 * n'est jamais atteint.
 */
export const DELAI_OUBLI_ECHECS_HEURES = 12;

/** Durée du verrou, en minutes, selon le nombre d'échecs consécutifs. */
export function dureeVerrouMinutes(tentativesEchouees: number): number {
  if (tentativesEchouees < SEUIL_VERROUILLAGE) return 0;
  const rang = tentativesEchouees - SEUIL_VERROUILLAGE;
  return PALIERS_VERROU_MINUTES[Math.min(rang, PALIERS_VERROU_MINUTES.length - 1)];
}

/** Instant de déverrouillage, ou null si le compte n'a pas à être verrouillé. */
export function instantDeverrouillage(tentativesEchouees: number, maintenant: Date): Date | null {
  const minutes = dureeVerrouMinutes(tentativesEchouees);
  return minutes === 0 ? null : new Date(maintenant.getTime() + minutes * 60_000);
}

/**
 * Le décompte d'un NOUVEL échec, et ce qu'il faut écrire. Le compteur
 * antérieur est oublié si le dernier échec date d'au moins le délai d'oubli,
 * JAMAIS parce qu'un verrou est échu. Un compte sans date de dernier échec
 * (compteur écrit avant le 2026-09-28, ou jamais d'échec) repart de zéro ·
 * son ancienneté est inconnue, et la lire comme récente ferait hériter un
 * titulaire d'échecs d'un autre âge.
 */
export function decompteApresEchec(
  user: { tentativesEchouees: number; dernierEchecLe: Date | null },
  maintenant: Date,
): { tentativesEchouees: number; verrouilleJusqua: Date | null; dernierEchecLe: Date } {
  const oublie =
    !user.dernierEchecLe ||
    maintenant.getTime() - user.dernierEchecLe.getTime() >= DELAI_OUBLI_ECHECS_HEURES * 3_600_000;
  const echecs = (oublie ? 0 : user.tentativesEchouees) + 1;
  return { tentativesEchouees: echecs, verrouilleJusqua: instantDeverrouillage(echecs, maintenant), dernierEchecLe: maintenant };
}

/**
 * LE LIEN DE DÉVERROUILLAGE S'EFFACE avec le verrou qu'il levait (relecture du
 * 2026-11-20) · connexion réussie, mot de passe changé ou réinitialisé,
 * déverrouillage par l'administrateur, adresse changée. Gardé, il rouvrirait
 * plus tard un compte refermé pour une autre raison.
 */
export const LIEN_DEVERROUILLAGE_EFFACE = { empreinteDeverrouillage: null, deverrouillageExpireLe: null, deverrouillageEnvoyePour: null } as const;

/**
 * Ce qu'écrit toute remise à zéro (succès, mot de passe changé ou réinitialisé,
 * déverrouillage) · le compteur, le verrou, le budget des codes faux sous
 * verrou et le lien de déverrouillage.
 */
export const DECOMPTE_REMIS_A_ZERO = {
  tentativesEchouees: 0,
  verrouilleJusqua: null,
  dernierEchecLe: null,
  codesFauxSousVerrou: 0,
  codesFauxSousVerrouPour: null,
  ...LIEN_DEVERROUILLAGE_EFFACE,
} as const;

/**
 * LE CODE DE DOUBLE AUTHENTIFICATION PENDANT LE VERROU A SA PROPRE LIMITE
 * (relecture du 2026-11-20, décision A). Le titulaire entre malgré le verrou
 * avec son bon mot de passe ET un code valide (`deverrouillage.ts`, porte a) ·
 * sans limite, qui tient le mot de passe devinait les six chiffres pendant le
 * verrou, qui ne freinait plus rien. AU PLUS CINQ CODES FAUX PAR PÉRIODE DE
 * VERROU · au-delà, le code n'est plus jugé jusqu'à l'échéance, et la réponse
 * reste celle d'un mot de passe faux. Un code faux compte aussi au compteur
 * du compte, qui prolonge le verrou · la période se poursuit alors, le
 * compteur suit la nouvelle échéance (`codesFauxSousVerrouPour`), sans quoi
 * chaque prolongation rouvrirait cinq essais. Une période close (échéance
 * passée, puis un nouveau verrou) repart de zéro. Convention d'OmegaX, comme
 * les paliers · cinq, le seuil du verrou lui-même.
 */
export const CODES_FAUX_PAR_PERIODE_DE_VERROU = 5;

type EtatCodesSousVerrou = { verrouilleJusqua: Date | null; codesFauxSousVerrou?: number | null; codesFauxSousVerrouPour?: Date | null };

const memeInstant = (a: Date | null | undefined, b: Date | null | undefined) => Boolean(a && b && a.getTime() === b.getTime());

/** Les codes faux déjà comptés pour le verrou EN COURS · zéro s'ils visaient un autre verrou. */
export function codesFauxDeLaPeriode(u: EtatCodesSousVerrou): number {
  return memeInstant(u.codesFauxSousVerrouPour, u.verrouilleJusqua) ? (u.codesFauxSousVerrou ?? 0) : 0;
}

/** Le code se juge-t-il encore pendant ce verrou ? */
export function codeJugeableSousVerrou(u: EtatCodesSousVerrou): boolean {
  return codesFauxDeLaPeriode(u) < CODES_FAUX_PAR_PERIODE_DE_VERROU;
}

/**
 * Ce qu'écrit un code faux pendant le verrou · l'échec au compteur du compte
 * (`decompteApresEchec`), le budget de la période porté sur la NOUVELLE
 * échéance, et le lien déjà parti pour ce verrou porté de même (un lien par
 * période, prolongations comprises).
 */
export function apresUnCodeFauxSousVerrou(
  u: EtatCodesSousVerrou & { tentativesEchouees: number; dernierEchecLe: Date | null; deverrouillageEnvoyePour?: Date | null },
  maintenant: Date,
) {
  const d = decompteApresEchec(u, maintenant);
  return {
    ...d,
    codesFauxSousVerrou: codesFauxDeLaPeriode(u) + 1,
    codesFauxSousVerrouPour: d.verrouilleJusqua,
    ...(memeInstant(u.deverrouillageEnvoyePour, u.verrouilleJusqua) ? { deverrouillageEnvoyePour: d.verrouilleJusqua } : {}),
  };
}

/**
 * LE MESSAGE D'UN REFUS DE CONNEXION, UN SEUL (audit final F238). Adresse
 * inconnue, mot de passe faux, compte verrouillé · les trois rendent CE texte,
 * mot pour mot. Le verrou disait jusque-là « Ce compte est temporairement
 * verrouillé… », et une adresse inconnue ne se verrouille jamais · il suffisait
 * de cinq essais pour savoir qu'une adresse avait un compte. La suspension est
 * donc nommée pour tous, sans dire si elle frappe ce compte · le titulaire
 * bloqué sait quoi attendre, l'inconnu n'apprend rien. Elle n'est pas non plus
 * réservée au BON mot de passe, qui la ferait servir d'oracle pendant le
 * verrou (auth.service.ts, `login`).
 */
export const MOTIF_IDENTIFIANTS_INVALIDES =
  "Identifiants invalides · après plusieurs essais manqués, un compte reste fermé quelques minutes. Son titulaire " +
  "peut entrer avec le code de sa double authentification, ou ouvrir le lien de déverrouillage reçu par courriel " +
  "s'il a donné le bon mot de passe ; à défaut, l'administrateur du dossier le déverrouille.";

/**
 * LE MOT DE PASSE ACTUEL D'UN GESTE AUTHENTIFIÉ COMPTE SES ÉCHECS (audit de
 * sécurité du 2026-11-19, constat `omegax-auth-mot-de-passe-actuel-hors-verrou`).
 * Changer le mot de passe ou l'adresse, déconnecter les autres appareils,
 * activer, retirer ou renouveler la double authentification comparaient le
 * mot de passe actuel sans rien compter · le porteur d'une session volée
 * (sans le mot de passe) le devinait à vingt essais par minute, puis changeait
 * le mot de passe et fermait les sessions du titulaire. Ces gestes passent
 * désormais par le MÊME compteur et le MÊME verrou que la connexion
 * (`decompteApresEchec`, oubli à douze heures). Le verrou n'éjecte pas la
 * session en cours · il refuse le geste, et le message le dit. Ici le compte
 * est celui de la session, déjà authentifiée · dire qu'il est fermé
 * n'apprend rien à qui ne le sait déjà.
 */
export const MOTIF_MOT_DE_PASSE_ACTUEL_INCORRECT = 'Le mot de passe actuel est incorrect';
export const MOTIF_CODE_INCORRECT = 'Code de vérification invalide';

export function motifGesteCompteFerme(jusqua: Date, maintenant: Date): string {
  const minutes = Math.max(1, Math.ceil((jusqua.getTime() - maintenant.getTime()) / 60_000));
  return (
    `Après plusieurs essais manqués, votre compte est fermé pour ${minutes} minute${minutes > 1 ? 's' : ''} · ` +
    'ce geste est refusé, et la connexion aussi, jusque-là. Votre session en cours reste ouverte.'
  );
}

/** Le compte est-il fermé à cet instant ? */
export function compteFerme(user: { verrouilleJusqua: Date | null }, maintenant: Date): boolean {
  return Boolean(user.verrouilleJusqua) && user.verrouilleJusqua! > maintenant;
}
