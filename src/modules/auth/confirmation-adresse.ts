import { randomBytes } from 'crypto';

/**
 * LA NOUVELLE ADRESSE DE CONNEXION SE CONFIRME PAR UN CODE REÇU À CETTE
 * ADRESSE (ligne multi-dossiers, second tour de relecture, MAJEUR 2).
 *
 * Posée sans confirmation, une adresse tapée par le titulaire d'une session
 * (ou par celui qui la lui a volée) devenait aussitôt l'identité du compte ·
 * (a) les invitations adressées à cette adresse s'affichaient, avec le nom
 * des cabinets qui l'invitaient ; (b) la vraie titulaire de l'adresse ne
 * pouvait plus l'employer ; (c) sur site, un administrateur qui ajoutait
 * cette adresse visait le compte de l'imposteur. Désormais la demande ne
 * change rien · un code à usage unique part à la NOUVELLE adresse
 * (`envoyerUnSecret`, jamais la file en clair), gardé en empreinte seulement,
 * et c'est le code, saisi depuis la même session, qui pose l'adresse.
 *
 * Sans messagerie · EN LIGNE, refus « messagerie requise » ; SUR SITE,
 * l'adresse se pose comme avant (le poste d'un seul organisme, aucun cabinet
 * tiers à tromper, et le rattachement à un autre dossier y exige désormais
 * l'acceptation de la personne · MAJEUR 3).
 */
export const ORIGINE_CONFIRMATION_ADRESSE = 'CONFIRMATION_ADRESSE';

/** Convention d'OmegaX · le code vaut vingt-quatre heures. */
export const HEURES_CONFIRMATION_ADRESSE = 24;

export function echeanceConfirmationAdresse(maintenant: Date): Date {
  return new Date(maintenant.getTime() + HEURES_CONFIRMATION_ADRESSE * 3_600_000);
}

/** 192 bits, en base64url · gardé en empreinte seulement. */
export function jetonConfirmationAdresse(): string {
  return randomBytes(24).toString('base64url');
}

export const MOTIF_CONFIRMATION_INVALIDE = 'Code introuvable, déjà utilisé ou échu · redemandez le changement d’adresse.';

export function avisConfirmationAdresse(jeton: string): { sujet: string; corps: string; corpsGarde: string } {
  const texte = (code: string) =>
    'Bonjour,\n\n' +
    'Une demande a été faite pour que cette adresse devienne l’adresse de connexion d’un compte OmegaX.\n\n' +
    `Code de confirmation · ${code}\n\n` +
    `Saisissez-le dans Fichier > Mon compte, depuis la session qui a fait la demande. Il vaut ${HEURES_CONFIRMATION_ADRESSE} heures.\n` +
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message · rien ne change sans ce code.\n";
  return {
    sujet: 'OmegaX · confirmez votre nouvelle adresse de connexion',
    corps: texte(jeton),
    corpsGarde: texte('[remis au seul destinataire, non conservé]'),
  };
}
