/**
 * LE DOSSIER QUE CET ONGLET AFFICHE (ligne multi-dossiers, relecture « échecs
 * silencieux », B1).
 *
 * Le cookie de session est partagé par tous les onglets. Après un changement
 * de dossier dans l'un, un autre resté sur l'ancien dossier écrirait dans le
 * nouveau · ses fenêtres, ses montants, son exercice sont ceux de l'ancien.
 * Trois défenses :
 *  · chaque requête qui modifie porte l'en-tête `X-Dossier` · le dossier lu
 *    ICI, en mémoire de l'onglet (jamais dans le stockage partagé, que l'autre
 *    onglet vient de réécrire) ; le serveur refuse en 409 un dossier qui n'est
 *    pas celui de la session (`JwtAuthGuard`), et l'écran propose de recharger ;
 *  · une relecture de `/auth/me` qui rend un autre dossier recharge l'onglet,
 *    au lieu d'habiller l'ancien écran du nom du nouveau ;
 *  · le stockage partagé annonce le dossier ouvert (`CLE_DOSSIER_OUVERT`) et le
 *    jeton CSRF · un autre onglet qui les change fait relire `/auth/me`
 *    (`lib/auth.tsx`).
 */
let dossierAffiche: string | null = null;

export const ENTETE_DOSSIER = 'X-Dossier';
export const CLE_DOSSIER_OUVERT = 'omegax:dossier-ouvert';

export type IssueDuDossier = 'POSE' | 'IDENTIQUE' | 'CHANGE';

/** Le dossier que `/auth/me` vient de rendre · posé la première fois, ensuite seulement comparé. */
export function poserDossierDeLEcran(id: string): IssueDuDossier {
  if (dossierAffiche === null) {
    dossierAffiche = id;
    try {
      localStorage.setItem(CLE_DOSSIER_OUVERT, id);
    } catch {
      /* stockage fermé · l'en-tête suffit */
    }
    return 'POSE';
  }
  return dossierAffiche === id ? 'IDENTIQUE' : 'CHANGE';
}

/**
 * L'ONGLET QUI CHANGE LUI-MÊME DE DOSSIER l'adopte avant de se recharger ·
 * sans quoi une relecture de `/auth/me` entre la réponse et le rechargement
 * prenait son propre geste pour celui d'un autre onglet, et rechargeait une
 * seconde fois par-dessus l'écran neuf. Le stockage partagé l'annonce aux
 * autres onglets, qui se rechargent.
 */
export function adopterDossierDeLEcran(id: string): void {
  dossierAffiche = id;
  try {
    localStorage.setItem(CLE_DOSSIER_OUVERT, id);
  } catch {
    /* stockage fermé · les autres onglets l'apprendront par le 409 */
  }
}

export function dossierDeLEcran(): string | null {
  return dossierAffiche;
}

/** À la déconnexion · la prochaine connexion de l'onglet pose son dossier. */
export function oublierDossierDeLEcran(): void {
  dossierAffiche = null;
}

/** L'en-tête des requêtes qui modifient · aucun sur une lecture (`entetes-requete.ts`). */
export function enteteDuDossier(methode: string | undefined): Record<string, string> {
  const m = (methode ?? 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || dossierAffiche === null) return {};
  return { [ENTETE_DOSSIER]: dossierAffiche };
}

/** Le refus du serveur pour un dossier changé dans un autre onglet. */
export function estRefusDossierChange(status: number, corps: unknown): boolean {
  return status === 409 && (corps as { dossierChange?: unknown } | null)?.dossierChange === true;
}

export const MOTIF_RECHARGER = 'Ce dossier a été changé dans un autre onglet · la page va être rechargée sur le dossier ouvert.';

let aRecharger = false;
/** Recharge l'onglet une fois, sur l'accueil · rien de l'ancien dossier ne reste à l'écran. */
export function rechargerSurLeDossierOuvert(recharger: () => void = () => window.location.reload()): void {
  if (aRecharger) return;
  aRecharger = true;
  try {
    window.alert(MOTIF_RECHARGER);
  } catch {
    /* sans fenêtre d'alerte, on recharge tout de même */
  }
  try {
    window.location.hash = '#/';
  } catch {
    /* rien */
  }
  recharger();
}
