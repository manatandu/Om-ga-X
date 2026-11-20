/**
 * LE LIEN DE DÉVERROUILLAGE S'OUVRE AU CLIC, JAMAIS AU CHARGEMENT (relecture
 * du 2026-11-20, E1). Un lien ouvert par un antivirus de messagerie, un
 * aperçu de lien ou un robot consommait le jeton à usage unique sans que le
 * titulaire l'ait voulu · la page attend son geste. Ce module porte la règle,
 * l'écran (`DeverrouillagePage`) l'appelle.
 */
export type IssueDeverrouillage = { etat: 'ROUVERT' } | { etat: 'ABANDONNE' } | { etat: 'ECHEC'; message: string };

export const MESSAGE_SERVEUR_MUET = 'Le serveur ne répond pas · vérifiez la connexion internet, puis réessayez.';

export async function rouvrirLeCompte(
  jeton: string,
  poster: (chemin: string, corps: unknown, signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal,
): Promise<IssueDeverrouillage> {
  try {
    await poster('/auth/deverrouiller', { jeton }, signal);
    return { etat: 'ROUVERT' };
  } catch (e) {
    // La personne a quitté la page · rien à dire, à personne.
    if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return { etat: 'ABANDONNE' };
    // Un refus du serveur porte son statut (`ApiError`, lib/api.ts, non importé ·
    // il lit le stockage local dès son chargement) ; le reste est une panne.
    const refus = e instanceof Error && typeof (e as { status?: unknown }).status === 'number';
    return { etat: 'ECHEC', message: refus && e.message ? e.message : MESSAGE_SERVEUR_MUET };
  }
}
