import { JOURS_CONSERVATION_ESSAI } from './essais-echus';

/**
 * LE COURRIEL DE RAPPEL AVANT SUPPRESSION · texte pur, ni base ni horloge.
 *
 * Il dit trois choses et n'en promet pas d'autre · la date à partir de laquelle
 * le dossier peut être supprimé, ce qu'il faut faire pour le garder (exporter,
 * ou souscrire), et ce que la suppression laisse derrière elle. Il ne porte AUCUN
 * secret et aucune donnée du dossier (ni son nom, ni un montant) : il part à
 * l'adresse de l'administrateur, et se lit dans la file du dossier.
 *
 * Le chemin d'exportation est celui de l'écran (`Fichier > Restituer le dossier
 * complet`) ; l'adresse de contact est celle que l'inscription en libre-service
 * donne déjà à celui qui n'a rien reçu.
 */
export const ADRESSE_CONTACT_EDITEUR = 'admin@vmgconsulting.net';

/** Un jour (minuit UTC) écrit en toutes lettres. */
const jourEnLettres = (jour: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(jour);

export function avisRappelSuppression(dates: { termeLe: Date; supprimableLe: Date }): { sujet: string; corps: string } {
  const corps =
    'Bonjour,\n\n' +
    `L'essai gratuit de votre dossier OmegaX a pris fin le ${jourEnLettres(dates.termeLe)}. Depuis, le dossier reste ` +
    `consultable et exportable, mais il n'est plus modifiable. Il est conservé ${JOURS_CONSERVATION_ESSAI} jours après ` +
    "la fin de l'essai.\n\n" +
    `Sans abonnement de votre part, il sera supprimé définitivement à partir du ${jourEnLettres(dates.supprimableLe)}, ` +
    'avec tout ce qu\'il contient : plan comptable, écritures, tiers, états, documents et utilisateurs. ' +
    'La suppression est irréversible.\n\n' +
    'Pour garder vos données, avant cette date :\n' +
    '- exportez le dossier : menu Fichier > Restituer le dossier complet (une archive ZIP, un fichier CSV par table) ;\n' +
    `- ou souscrivez un abonnement en écrivant à ${ADRESSE_CONTACT_EDITEUR}.\n\n` +
    'Les sauvegardes chiffrées de la nuit gardent une trace du dossier jusqu\'à leur propre terme.\n\n' +
    'VMG Consulting\n';
  return { sujet: `OmegaX · votre dossier d'essai sera supprimé à partir du ${jourEnLettres(dates.supprimableLe)}`, corps };
}
