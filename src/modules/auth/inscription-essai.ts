import { JOURS_ESSAI } from '../plateforme/abonnements/facturation-abonnements';
import { motDePasseTireAuSort } from '../plateforme/reinitialisation-admin';

/**
 * L'INSCRIPTION EN LIBRE-SERVICE AVEC ESSAI (décision de Manasse du 2026-10-10,
 * « faire comme les autres logiciels », levée du gel le 2026-10-17 pour
 * l'inscription et l'essai seuls, sans le paiement en ligne).
 *
 * `POST /auth/register` reste FERMÉ (option A) · un dossier auto-créé y recevait
 * une licence sans échéance, le produit gratuit à vie à côté du produit vendu.
 * Cette porte-ci ne crée que des dossiers d'ESSAI, à échéance, et elle n'ouvre
 * aucune session · le mot de passe provisoire part au SEUL courriel donné, qui
 * se trouve ainsi vérifié (« VMG ne voit jamais les informations d'un client »,
 * décision du 2026-10-09 ; même parti que la console).
 */
export const ORIGINE_INSCRIPTION_ESSAI = 'INSCRIPTION_ESSAI';

/** Fin de l'essai · trente jours, le même nombre que la facturation des abonnements. */
export function finDeLEssai(debut: Date): Date {
  const fin = new Date(debut.getTime());
  fin.setUTCDate(fin.getUTCDate() + JOURS_ESSAI);
  return fin;
}

export { JOURS_ESSAI, motDePasseTireAuSort };

/**
 * Le renvoi du mot de passe d'un dossier d'essai que son titulaire n'a pas
 * encore ouvert (courriel perdu, ou jamais parti · l'adresse déjà prise ne doit
 * pas enfermer celui qui n'a rien reçu). Il ne sert QU'À CELA · le mot de passe
 * ne part qu'à l'adresse du compte, et un second renvoi attend dix minutes pour
 * qu'un tiers qui connaît l'adresse ne puisse pas renouveler sans fin le mot de
 * passe de son titulaire. `dernierEnvoi` est l'instant de la dernière
 * remise (`sessionsInvalidesAvant`, posé à chaque renvoi), à défaut la
 * naissance du compte.
 */
export const FENETRE_RENVOI_HEURES = 72;
export const ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES = 10;

export function renvoiPossible(
  compte: { doitChangerMotDePasse: boolean; createdAt: Date; sessionsInvalidesAvant: Date | null },
  maintenant: Date,
): boolean {
  if (!compte.doitChangerMotDePasse) return false;
  if (maintenant.getTime() - compte.createdAt.getTime() > FENETRE_RENVOI_HEURES * 3_600_000) return false;
  const dernierEnvoi = compte.sessionsInvalidesAvant ?? compte.createdAt;
  return maintenant.getTime() - dernierEnvoi.getTime() >= ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES * 60_000;
}

/**
 * Seul le dossier né de CETTE porte se rouvre par elle · son essai dure
 * exactement `JOURS_ESSAI` jours de sa licence (`finDeLEssai`, posée dans la
 * transaction de `register`). Un cabinet ouvert par la console ou par un siège,
 * même avec un mot de passe provisoire encore actif, n'est jamais touché par un
 * inconnu qui connaît son adresse. Tolérance d'une minute pour l'écart entre
 * les deux horloges de la transaction.
 */
export function estUnDossierDEssai(licence: { type: string; dateDebut: Date; dateExpiration: Date | null } | null | undefined): boolean {
  if (!licence || licence.type !== 'ABONNEMENT' || !licence.dateExpiration) return false;
  const ecart = licence.dateExpiration.getTime() - licence.dateDebut.getTime();
  return Math.abs(ecart - JOURS_ESSAI * 86_400_000) <= 60_000;
}

const jour = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Kinshasa', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

/**
 * Le courriel · le mot de passe, la fin de l'essai, et rien du dossier.
 * `corpsGarde` est ce que la file du dossier conserve (`envoyerUnSecret`).
 */
export function avisInscriptionEssai(motDePasseProvisoire: string, finEssai: Date, nouveau: boolean): {
  sujet: string;
  corps: string;
  corpsGarde: string;
} {
  const texte = (mot: string) =>
    'Bonjour,\n\n' +
    (nouveau
      ? `Votre dossier d'essai OmegaX est ouvert. L'essai est gratuit, jusqu'au ${jour(finEssai)}.\n\n`
      : "Voici un nouveau mot de passe provisoire pour votre dossier d'essai OmegaX, que vous n'avez pas encore ouvert.\n\n") +
    `Mot de passe provisoire · ${mot}\n\n` +
    "Il vous sera demandé de le changer à votre première connexion. Si vous n'êtes pas à l'origine de cette demande, " +
    'ignorez ce message : sans ce mot de passe, personne ne peut ouvrir le dossier.\n\n' +
    "À la fin de l'essai le dossier reste consultable, mais plus modifiable, jusqu'à l'abonnement.\n\n" +
    "VMG Consulting n'a pas connaissance de ce mot de passe.\n";
  return {
    sujet: nouveau ? "OmegaX · votre dossier d'essai" : 'OmegaX · votre mot de passe provisoire',
    corps: texte(motDePasseProvisoire),
    corpsGarde: texte('[remis au seul destinataire, non conservé]'),
  };
}
