import { normaliserCourriel } from '../../common/courriel';

/**
 * LA DEMANDE D'INFORMATION DE LA PAGE PUBLIQUE (ligne commercial-site, gel
 * levé par Manasse le 2026-11-01).
 *
 * Un visiteur écrit à l'équipe d'OmegaX depuis `/vitrine/`. Rien n'est gardé
 * que le MESSAGE mis en file par `CourrierService`, dans le dossier de
 * l'éditeur, adressé aux opérateurs de la plateforme · aucune table de
 * prospects, aucun compte, aucune liste. Règles pures, sans base ni réseau.
 *
 * Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023) · le
 * traitement repose sur le CONSENTEMENT de la personne (art. 192), que le
 * responsable doit pouvoir DÉMONTRER (art. 196, al. 1er) · le message porte
 * donc la case cochée et l'instant de la réception. Les informations de
 * l'art. 220 sont données à la collecte, par la page et par la politique de
 * confidentialité.
 */

export const ORIGINE_DEMANDE_INFORMATION = 'DEMANDE_INFORMATION';

/** Au-delà, une liste d'opérateurs est une erreur de configuration, pas une équipe. */
export const DESTINATAIRES_MAXIMUM = 5;

/**
 * Les adresses des opérateurs, lues dans `OPERATEURS_PLATEFORME` comme le fait
 * la promotion des opérateurs (`PlateformeService.onModuleInit`) · séparées par
 * des virgules, normalisées, sans doublon. Jamais rendues au client.
 */
export function destinatairesDesDemandes(brut: string | undefined | null): string[] {
  if (!brut) return [];
  const vues = new Set<string>();
  for (const morceau of brut.split(',')) {
    const e = normaliserCourriel(morceau);
    if (e.length > 0) vues.add(e);
  }
  return [...vues].slice(0, DESTINATAIRES_MAXIMUM);
}

export interface DemandeInformation {
  nom: string;
  organisation: string;
  email: string;
  telephone?: string | null;
  message: string;
  consentement: boolean;
}

/**
 * Une ligne d'en-tête ne porte ni retour à la ligne ni caractère de contrôle ·
 * un nom d'organisation qui en porterait écrirait d'autres en-têtes au courriel.
 */
export function surUneLigne(texte: string): string {
  return texte.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Le corps garde ses retours à la ligne, jamais les autres caractères de contrôle. */
function texteLibre(texte: string): string {
  return texte.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ').trim();
}

/** L'heure de Kinshasa (UTC+1), écrite en clair · le courriel ne dépend pas du fuseau du serveur. */
function instantDeKinshasa(d: Date): string {
  const k = new Date(d.getTime() + 60 * 60_000);
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${deux(k.getUTCDate())}/${deux(k.getUTCMonth() + 1)}/${k.getUTCFullYear()} à ${deux(k.getUTCHours())} h ${deux(k.getUTCMinutes())} (heure de Kinshasa)`;
}

export function composerDemande(d: DemandeInformation, recueLe: Date): { sujet: string; corps: string } {
  const organisation = surUneLigne(d.organisation);
  const telephone = d.telephone ? surUneLigne(d.telephone) : '';
  const corps = [
    'Demande reçue par le formulaire de la page de présentation d’OmegaX.',
    '',
    `Nom · ${surUneLigne(d.nom)}`,
    `Organisation · ${organisation}`,
    `Adresse de réponse · ${normaliserCourriel(d.email)}`,
    `Téléphone · ${telephone || 'non donné'}`,
    `Reçue le · ${instantDeKinshasa(recueLe)}`,
    '',
    'Message',
    '-------',
    texteLibre(d.message),
    '',
    'Consentement · la personne a coché la case « J’accepte que ces informations servent à répondre à ma demande »',
    '(Code du numérique, ordonnance-loi n° 23/10 du 13 mars 2023, art. 192 et 196). Elles ne servent à rien d’autre.',
  ].join('\n');
  return { sujet: `Demande d'information · ${organisation}`.slice(0, 200), corps };
}
