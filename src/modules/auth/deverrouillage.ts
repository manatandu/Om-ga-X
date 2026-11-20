import { randomBytes } from 'crypto';
import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ADRESSE_APPLICATION } from '../utilisateurs/invitations';

/**
 * UN INCONNU NE TIENT PLUS UN COMPTE FERMÉ (audit de sécurité du 2026-11-19,
 * constat `omegax-auth-verrou-entretenu-par-un-tiers`).
 *
 * Cinq mots de passe faux ferment le compte, et un essai par échéance le
 * refermait · un tiers qui connaissait l'adresse (elle figure sur tous les
 * courriels d'un comptable) tenait le titulaire dehors sans fin, bon mot de
 * passe compris. La force brute ne s'affaiblit pas pour autant · pendant le
 * verrou, la RÉPONSE reste mot pour mot celle d'un mot de passe faux
 * (`MOTIF_IDENTIFIANTS_INVALIDES`), sans quoi elle dirait au devineur que son
 * mot de passe est le bon. Deux portes s'ouvrent au seul titulaire.
 *
 *  (a) LE SECOND FACTEUR · un compte à double authentification qui présente
 *      le bon mot de passe ET un code valide (application ou code de secours)
 *      entre malgré le verrou, et le compteur se remet à zéro comme après
 *      toute connexion réussie. Le code voyage avec le premier appel · pendant
 *      le verrou, la demande de code (`deuxiemeFacteurRequis`) ne part jamais,
 *      elle aussi dirait le mot de passe juste. Un code faux avec le bon mot
 *      de passe compte un échec, APRÈS la réponse.
 *
 *  (b) LE LIEN PAR COURRIEL · le bon mot de passe présenté pendant le verrou
 *      fait partir un lien de déverrouillage à usage unique, valable une
 *      heure, au seul courriel du compte, DIRECTEMENT (`envoyerUnSecret`,
 *      jamais la file lisible du dossier), au plus une fois par période de
 *      verrou. L'envoi se fait APRÈS la réponse · un courriel attendu
 *      allongerait la seule réponse au bon mot de passe, et la durée dirait
 *      ce que le message tait. Le lien lève le verrou, remet le compteur à
 *      zéro (journal d'audit) et ramène à la connexion.
 *
 *      Le lien est EFFACÉ par une connexion réussie, un mot de passe changé
 *      ou réinitialisé, une adresse changée, un déverrouillage par
 *      l'administrateur (`LIEN_DEVERROUILLAGE_EFFACE`, verrouillage.ts).
 *
 * SUR SITE, OU SANS MESSAGERIE, rien ne part · le
 * déverrouillage par l'administrateur du dossier reste la voie
 * (`POST /utilisateurs/:id/deverrouiller`), et pour une personne qui a
 * plusieurs dossiers, « Réinitialiser par courriel » ou, sur site,
 * l'administrateur de l'installation (`POST /sur-site/comptes/reinitialiser`).
 */
export const ORIGINE_DEVERROUILLAGE_COMPTE = 'DEVERROUILLAGE_COMPTE';

/** Convention d'OmegaX · le lien vaut une heure, la durée du plus long palier du verrou. */
export const MINUTES_LIEN_DEVERROUILLAGE = 60;

export function echeanceLienDeverrouillage(maintenant: Date): Date {
  return new Date(maintenant.getTime() + MINUTES_LIEN_DEVERROUILLAGE * 60_000);
}

/** 256 bits, en base64url · gardé en empreinte seulement. */
export function jetonDeverrouillage(): string {
  return randomBytes(32).toString('base64url');
}

export const MOTIF_LIEN_DEVERROUILLAGE_INVALIDE = 'Lien de déverrouillage introuvable, déjà utilisé ou échu · reconnectez-vous avec votre mot de passe pour en recevoir un autre.';

export function avisDeverrouillage(jeton: string): { sujet: string; corps: string; corpsGarde: string } {
  const texte = (lien: string) =>
    'Bonjour,\n\n' +
    'Votre compte OmegaX est fermé pour quelques minutes après plusieurs essais de connexion manqués. ' +
    'Votre bon mot de passe vient d’être présenté pendant cette fermeture.\n\n' +
    `Pour rouvrir votre compte tout de suite, ouvrez ce lien · ${lien}\n\n` +
    `Il vaut ${MINUTES_LIEN_DEVERROUILLAGE} minutes et ne sert qu’une fois. ` +
    "Si vous n'êtes pas à l'origine de cette connexion, ne l'ouvrez pas et changez votre mot de passe dès que vous le pourrez · " +
    'quelqu’un le connaît.\n';
  return {
    sujet: 'OmegaX · rouvrir votre compte',
    corps: texte(`${ADRESSE_APPLICATION}/#/deverrouiller?jeton=${encodeURIComponent(jeton)}`),
    corpsGarde: texte('[remis au seul destinataire, non conservé]'),
  };
}

/**
 * POURQUOI UNE RÉSERVATION NE PREND PAS LA PLACE · la ligne relue sous verrou
 * ne dit plus un compte fermé, ou le lien de ce verrou est déjà parti. `null`
 * quand la place se prend. Le motif se CONSIGNE (relecture du 2026-11-20,
 * A3) · une réservation qui ne trouve rien ne se tait plus.
 */
export function motifSansLienDeDeverrouillage(
  frais: { verrouilleJusqua: Date | null; deverrouillageEnvoyePour: Date | null } | null,
  maintenant: Date,
): string | null {
  if (!frais) return 'compte introuvable';
  if (!frais.verrouilleJusqua || frais.verrouilleJusqua <= maintenant) return 'compte rouvert entre-temps, aucun verrou à lever';
  if (frais.deverrouillageEnvoyePour && frais.deverrouillageEnvoyePour.getTime() === frais.verrouilleJusqua.getTime()) {
    return 'lien déjà parti pour ce verrou';
  }
  return null;
}

/**
 * UN ÉCHEC DE `envoyerUnSecret` LAISSE-T-IL UN LIEN PEUT-ÊTRE REÇU ? (relecture
 * du 2026-11-20). `false` seulement quand RIEN n'est parti à coup sûr · erreur
 * levée avant l'envoi (`BadRequestException` de la préparation du message,
 * `ConflictException` sans messagerie), ou transport qui refuse net (connexion
 * refusée, hôte introuvable, authentification, code SMTP de refus). Un délai
 * dépassé ou une connexion coupée en route ne se situent pas · le serveur a pu
 * accepter le message. Toute autre erreur suit un envoi accepté (la trace de
 * la file) · `true`.
 */
export function envoiPeutEtreParti(erreur: unknown): boolean {
  if (erreur instanceof BadRequestException || erreur instanceof ConflictException) return false;
  if (!(erreur instanceof ServiceUnavailableException)) return true;
  const texte = erreur.message;
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|EPIPE|socket hang up|closed unexpectedly|connection closed/i.test(texte)) return true;
  return !/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|EAUTH|auth|\b[45]\d\d\b|TransportAbsent/i.test(texte);
}
