import { randomBytes } from 'crypto';
import { RoleUtilisateur } from '@prisma/client';
import { estSurSite } from '../../common/mode-installation';

/**
 * L'INVITATION D'UNE PERSONNE À UN DOSSIER (ligne multi-dossiers, relecture
 * de sécurité du 2026-11-01, décision du coordinateur · « le rattachement
 * d'une adresse déjà connue se fait par invitation acceptée par la personne »).
 *
 * POURQUOI TOUTE CRÉATION PASSE PAR L'INVITATION QUAND LA MESSAGERIE EST LÀ ·
 * si l'adresse neuve créait un compte tout de suite et l'adresse connue une
 * invitation, la liste du dossier, la réponse et le mot de passe saisi par
 * l'administrateur diraient laquelle existait ailleurs (l'oracle E1). En
 * ligne avec une messagerie, l'administrateur nomme une adresse et un rôle,
 * RIEN n'est créé, et la même invitation part dans les deux cas · la personne
 * l'accepte avec le jeton reçu (connectée si elle a un compte, en choisissant
 * son mot de passe sinon). Aucun mot de passe n'est saisi par l'administrateur.
 *
 * LA CRÉATION DIRECTE RESTE SANS MESSAGERIE (`modeDeCreation`) ·
 *  · SUR SITE, toujours · le poste sert les dossiers d'UN organisme sous la
 *    licence de son installation (`sur-site/`), il n'y a pas d'autre cabinet
 *    à protéger, et la messagerie y est rarement posée ; une adresse déjà
 *    connue sur le poste y est rattachée directement, son mot de passe à elle ;
 *  · EN LIGNE SANS MESSAGERIE, l'adresse neuve se crée comme avant ; l'adresse
 *    connue est refusée par « la messagerie est requise pour ce geste », qui ne
 *    dit pas qu'elle existe. Cette différence (création contre refus) reste un
 *    signal dans ce mode dégradé · limite écrite, la messagerie la ferme.
 */
export type ModeDeCreation = 'INVITATION' | 'DIRECTE';

export function modeDeCreation(messagerieConfiguree: boolean, env: NodeJS.ProcessEnv = process.env): ModeDeCreation {
  if (estSurSite(env)) return 'DIRECTE';
  return messagerieConfiguree ? 'INVITATION' : 'DIRECTE';
}

/** Convention d'OmegaX · quatorze jours pour accepter, ensuite l'invitation échoit. */
export const JOURS_INVITATION = 14;

export function echeanceInvitation(maintenant: Date): Date {
  return new Date(maintenant.getTime() + JOURS_INVITATION * 86_400_000);
}

/** Un jeton à usage unique · 256 bits, en base64url, jamais gardé en clair. */
export function jetonInvitation(): string {
  return randomBytes(32).toString('base64url');
}

/** L'adresse de l'application en ligne · le seul mode où l'invitation part (`modeDeCreation`). */
export const ADRESSE_APPLICATION = 'https://oomega.web.app';

const LIBELLES_ROLES: Record<RoleUtilisateur, string> = {
  ADMIN_CABINET: 'administrateur',
  COMPTABLE: 'comptable',
  AIDE_COMPTABLE: 'aide-comptable',
  GESTIONNAIRE_PAIE: 'gestionnaire de paie',
  LECTURE_SEULE: 'lecture seule',
};

/**
 * LE MÊME COURRIEL, QUE L'ADRESSE AIT UN COMPTE OU NON · le corps gardé dans
 * la file du dossier (lisible de ses utilisateurs) ne doit pas dire lequel.
 * Le jeton n'y est jamais (`CourrierService.envoyerUnSecret`).
 */
export function avisInvitation(p: { entite: string; role: RoleUtilisateur; jeton: string; expireLe: Date }) {
  const lien = `${ADRESSE_APPLICATION}/#/invitation?jeton=${encodeURIComponent(p.jeton)}`;
  const echeance = p.expireLe.toISOString().slice(0, 10).split('-').reverse().join('/');
  const tete = [
    `Le dossier « ${p.entite} » vous invite à y travailler, avec le rôle de ${LIBELLES_ROLES[p.role]}.`,
    '',
  ];
  const pied = [
    '',
    'Si vous avez déjà un compte OmegaX, connectez-vous d’abord, puis acceptez ou refusez l’invitation sur cette page.',
    'Sinon, vous y choisirez votre mot de passe.',
    `L'invitation vaut jusqu'au ${echeance}. Si vous ne l'attendiez pas, ignorez ce message.`,
  ];
  return {
    sujet: `Invitation au dossier ${p.entite}`,
    corps: [...tete, `Ouvrez ce lien : ${lien}`, `Ou saisissez ce code : ${p.jeton}`, ...pied].join('\n'),
    corpsGarde: [...tete, 'Ouvrez le lien reçu par courriel (non conservé ici).', ...pied].join('\n'),
  };
}
