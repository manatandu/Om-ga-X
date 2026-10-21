/**
 * LA CAUSE D'UN ÉCHEC D'ENVOI, RÉDUITE À UNE CATÉGORIE · jamais le texte.
 *
 * VMG NE VOIT JAMAIS LES INFORMATIONS D'UN CLIENT (CLAUDE.md § 8). Le texte
 * qu'un serveur de messagerie rend sur un refus porte presque toujours l'adresse
 * du destinataire (« 550 5.1.1 <jean@client.cd>: Recipient address rejected »),
 * et le refus d'écriture de la file la cite aussi (« Adresse de destinataire
 * inutilisable · « … » »). La console de l'éditeur, son compte rendu des rappels
 * et le journal du serveur ne reçoivent donc qu'une CATÉGORIE, de quoi savoir
 * quoi faire (vérifier la messagerie, attendre le réseau, demander au client une
 * autre adresse), jamais de quoi lire l'adresse. Le texte brut reste là où il
 * est, dans la file du dossier, que seul le dossier lit.
 *
 * Module pur · une liste de motifs, aucune base, aucun réseau.
 */
export type CauseEchecEnvoi = 'REFUS_DESTINATAIRE' | 'AUTHENTIFICATION' | 'RESEAU' | 'AUTRE';

export const LIBELLES_CAUSE_ECHEC: Readonly<Record<CauseEchecEnvoi, string>> = {
  REFUS_DESTINATAIRE: 'adresse refusée par le serveur du destinataire',
  AUTHENTIFICATION: 'authentification de la messagerie refusée',
  RESEAU: 'serveur de messagerie injoignable',
  AUTRE: 'autre cause',
};

// L'ordre compte · un refus de destinataire peut citer le mot « relay » ou
// « connection » plus loin dans la phrase, la catégorie la plus précise passe
// d'abord.
const MOTIFS: readonly [CauseEchecEnvoi, RegExp][] = [
  [
    'REFUS_DESTINATAIRE',
    /\b5\.1\.\d\b|\b55[0-3]\b|recipient|mailbox|user unknown|no such user|unknown user|adresse de destinataire|destinataire inconnu|address rejected/i,
  ],
  ['AUTHENTIFICATION', /\b53[0-58]\b|\b5\.7\.[08]\b|auth|credential|login|password|mot de passe|identifiant/i],
  [
    'RESEAU',
    /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|ESOCKET|ECONNECTION|EDNS|timeout|timed out|socket|connexion|connection|\bTLS\b|certificate|certificat|\b42[01]\b/i,
  ],
];

/** La catégorie d'une erreur d'envoi · `null` quand il n'y a pas d'erreur. */
export function causeEchecEnvoi(erreur: string | null | undefined): CauseEchecEnvoi | null {
  if (erreur === null || erreur === undefined || erreur.trim() === '') return null;
  for (const [cause, motif] of MOTIFS) if (motif.test(erreur)) return cause;
  return 'AUTRE';
}

/** La catégorie d'une erreur LEVÉE (exception), lue sur son nom et son message, rendue sans eux. */
export function causeDeLException(erreur: unknown): CauseEchecEnvoi {
  const texte = erreur instanceof Error ? `${erreur.name} ${erreur.message} ${(erreur as { code?: unknown }).code ?? ''}` : String(erreur);
  return causeEchecEnvoi(texte) ?? 'AUTRE';
}
