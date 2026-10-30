/**
 * LA MESSAGERIE INTERNE (ligne dossier-l9, fonction 95 · Sage, « messagerie
 * entre utilisateurs du fichier »). Les règles pures · le service les joue.
 *
 *  · UN MÊME DOSSIER, JAMAIS AU-DELÀ · un message ne va qu'à des
 *    utilisateurs ACTIFS du dossier de son expéditeur (relus par le serveur,
 *    jamais reçus du client), ni vers un autre dossier, ni vers l'éditeur.
 *
 *  · LA CORRESPONDANCE EST CONFIDENTIELLE · Code du numérique (ordonnance-loi
 *    n° 23/10 du 13 mars 2023), art. 193, 2°, « traitées de manière
 *    confidentielle et protégée ». Un message se lit par son expéditeur et
 *    ses destinataires seulement · l'administrateur du dossier n'y a pas
 *    accès, et son OBJET et son CORPS ne passent pas au journal d'audit
 *    (`COLONNES_EXCLUES_PAR_MODELE`), qui garde l'envoi, l'auteur et la date ·
 *    le corps est une correspondance, qui peut porter des données
 *    personnelles de toute nature (art. 195), et le journal se lit par
 *    d'autres que ses correspondants.
 *
 *  · CHACUN RETIRE DE SA BOÎTE · le destinataire retire le message de sa
 *    réception, l'expéditeur de ses envoyés · personne ne retire le message
 *    de la boîte d'un autre. Un message que tous ont retiré se supprime
 *    (art. 193, 3° · aucune finalité ne le retient plus).
 */

export const LONGUEUR_OBJET = 150;
export const LONGUEUR_CORPS = 5000;
export const PLAFOND_DESTINATAIRES = 50;
/** Les boîtes se lisent par tranches · au-delà, le total le dit. */
export const TAILLE_BOITE = 100;

/** Pourquoi l'envoi est refusé, ou null. Même règle à la porte et dans le service. */
export function motifRefusEnvoi(m: { objet: string; corps: string; destinataireIds: string[] }, expediteurId: string): string | null {
  if (!m.objet.trim()) return "Le message n'a pas d'objet.";
  if (m.objet.length > LONGUEUR_OBJET) return `L'objet tient en ${LONGUEUR_OBJET} caractères au plus.`;
  if (!m.corps.trim()) return 'Le message est vide.';
  if (m.corps.length > LONGUEUR_CORPS) return `Un message tient en ${LONGUEUR_CORPS.toLocaleString('fr-FR')} caractères au plus.`;
  const uniques = new Set(m.destinataireIds);
  if (uniques.size === 0) return 'Choisissez au moins un destinataire.';
  if (uniques.size > PLAFOND_DESTINATAIRES) return `Un message va à ${PLAFOND_DESTINATAIRES} destinataires au plus.`;
  if (uniques.has(expediteurId)) return 'Vous ne vous écrivez pas à vous-même.';
  return null;
}
