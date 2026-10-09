import { randomInt } from 'crypto';

/**
 * LE MOT DE PASSE PROVISOIRE D'UN ADMINISTRATEUR DE CABINET, REMIS AU SEUL
 * CLIENT (décision de Manasse du 2026-10-09 · « VMG ne doit pas voir les
 * informations du client, c'est confidentiel et non discutable »).
 *
 * La console le faisait choisir par l'opérateur, qui pouvait alors ouvrir le
 * dossier du client avant lui. Il est tiré au sort par le serveur, part au
 * courriel de l'administrateur, et n'est rendu à personne d'autre. Le
 * changement reste exigé à la première connexion (`doitChangerMotDePasse`).
 */
export const ORIGINE_REINITIALISATION_ADMIN = 'REINITIALISATION_ADMIN';

/** Sans caractères qu'on confond à la lecture (0 et O, 1, l et I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Seize caractères tirés par le générateur cryptographique · au-delà des dix
 * qu'exige le changement de mot de passe, une majuscule, une minuscule et un
 * chiffre garantis.
 */
export function motDePasseTireAuSort(longueur = 16): string {
  const tirer = (jeu: string) => jeu[randomInt(jeu.length)];
  const caracteres = [
    tirer('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    tirer('abcdefghijkmnpqrstuvwxyz'),
    tirer('23456789'),
    ...Array.from({ length: Math.max(longueur, 10) - 3 }, () => tirer(ALPHABET)),
  ];
  // Mélange de Fisher-Yates · les trois garantis ne restent pas en tête.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

/**
 * Le courriel remis à l'administrateur · le mot de passe, et rien du dossier.
 * `corpsGarde` est ce que la file du dossier conserve (`envoyerUnSecret`) · le
 * même texte, le mot de passe remplacé, pour qu'aucun collègue ne le lise
 * dans l'historique des courriels avant son titulaire.
 */
export function avisReinitialisationAdmin(motDePasseProvisoire: string): {
  sujet: string;
  corps: string;
  corpsGarde: string;
} {
  const texte = (mot: string) =>
    'Bonjour,\n\n' +
    "À votre demande, l'accès administrateur de votre dossier OmegaX a été réinitialisé.\n\n" +
    `Mot de passe provisoire · ${mot}\n\n` +
    'Il vous sera demandé de le changer à votre première connexion. Vos sessions ouvertes ont été fermées, et la ' +
    "double authentification devra être réactivée.\n\nVMG Consulting n'a pas connaissance de ce mot de passe.\n";
  return {
    sujet: 'OmegaX · votre mot de passe provisoire',
    corps: texte(motDePasseProvisoire),
    corpsGarde: texte('[remis au seul destinataire, non conservé]'),
  };
}
