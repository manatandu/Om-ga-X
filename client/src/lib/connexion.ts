import type { AuthResponse } from './types';

/**
 * LA CONNEXION, VUE DE L'ÉCRAN D'OUVERTURE · ce que `POST /auth/login` reçoit,
 * et ce que sa réponse demande à l'écran de faire.
 */

/** Ce que rend `POST /auth/login` · un code attendu, ou une session posée. */
export type ReponseConnexion = { deuxiemeFacteurRequis: true } | AuthResponse;

/**
 * LA CASE VOYAGE AVEC LE CODE, COMME LE MOT DE PASSE (audit final F270) · le
 * serveur ne garde aucun état entre l'appel qui réclame le second facteur et
 * celui qui le porte, et c'est au second qu'il décide de la durée de la
 * session. Une case perdue en route ouvrirait une session courte à qui l'a
 * cochée.
 */
export function corpsConnexion(s: {
  email: string;
  motDePasse: string;
  resterConnecte: boolean;
  codeRequis: boolean;
  code: string;
}) {
  return {
    email: s.email,
    motDePasse: s.motDePasse,
    resterConnecte: s.resterConnecte,
    ...(s.codeRequis && s.code.trim() ? { code: s.code.trim() } : {}),
  };
}

/**
 * Ce que la réponse demande à l'écran · un code, ou l'entrée. La session
 * s'ouvre toujours comme demandé · l'opérateur de la console aussi reste
 * connecté depuis le 2026-10-09 (décision de Manasse), et c'est la console
 * qui redemande le mot de passe et le code après huit heures. L'avis « session
 * courte » qui s'affichait ici avant d'entrer n'a plus d'objet.
 */
export type IssueConnexion = { etape: 'CODE_REQUIS' } | { etape: 'OUVERTE'; csrfToken: string };

export function issueConnexion(res: ReponseConnexion): IssueConnexion {
  if ('deuxiemeFacteurRequis' in res) return { etape: 'CODE_REQUIS' };
  return { etape: 'OUVERTE', csrfToken: res.csrfToken };
}
