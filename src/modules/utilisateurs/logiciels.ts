/**
 * LES « LOGICIELS » (TUILES) QU'UN UTILISATEUR VOIT APRÈS SA CONNEXION.
 *
 * Demande de Manasse du 2026-10-25 : l'utilisateur choisit ce qui le concerne,
 * le reste n'est pas à sa portée. Cette liste ne porte QUE les clés, fermée ·
 * les libellés et le rangement des commandes vivent dans le client
 * (`client/src/lib/logiciels.ts`), confrontés au menu réel, et un spec du
 * client relit CE fichier pour que les deux listes ne divergent pas.
 *
 * C'EST UN AFFICHAGE, JAMAIS UN DROIT (masquer n'est pas refuser). Aucune
 * route ne se refuse sur ce fondement · les droits restent ceux du rôle, du
 * référentiel et du profil de fonctions. Refuser module par module est le
 * niveau 3, au suivi (AVANCEMENT-ecran-logiciels.md).
 */
export const LOGICIELS = [
  'COMPTABILITE',
  'TIERS_TRESORERIE',
  'IMMOBILISATIONS',
  'PAIE',
  'REVISION_AUDIT',
  'GESTION_COMMERCIALE',
  'GROUPE_CONSOLIDATION',
  'IFRS',
  'ADMINISTRATION',
] as const;

export type Logiciel = (typeof LOGICIELS)[number];

/**
 * Ce que la session rend à l'écran · `null` = toutes les tuiles. Un
 * administrateur n'est jamais restreint (il ouvre et ferme celles des
 * autres), même si une ligne ancienne porterait le drapeau. Une clé que la
 * liste ne connaît plus (tuile retirée depuis) n'ouvre rien et ne casse rien.
 */
export function logicielsDeLaSession(u: {
  role: string;
  restreindreLogiciels?: boolean | null;
  logicielsAutorises?: string[] | null;
}): string[] | null {
  if (u.role === 'ADMIN_CABINET' || !u.restreindreLogiciels) return null;
  const connus: readonly string[] = LOGICIELS;
  return (u.logicielsAutorises ?? []).filter((l) => connus.includes(l));
}

/**
 * LES CLÉS ATTRIBUÉES QUE LA LISTE NE CONNAÎT PLUS (tuile retirée depuis) ·
 * rendues À PART pour être NOMMÉES à l'écran, jamais comptées comme une
 * attribution valide. Sans elles, un utilisateur dont l'attribution ne
 * porterait que des clés mortes verrait « aucun logiciel » sans savoir pourquoi.
 */
export function logicielsRetiresDeLaSession(u: {
  role: string;
  restreindreLogiciels?: boolean | null;
  logicielsAutorises?: string[] | null;
}): string[] {
  if (u.role === 'ADMIN_CABINET' || !u.restreindreLogiciels) return [];
  const connus: readonly string[] = LOGICIELS;
  return (u.logicielsAutorises ?? []).filter((l) => !connus.includes(l));
}

/**
 * Les rôles qui ne suivent pas les logiciels · l'administrateur (jamais
 * restreint) et le gestionnaire de paie, qui a son propre menu réduit
 * (`AppShell`, `fenetreOuverteAuRole`). Une attribution posée sur eux ne
 * changerait rien à l'écran · elle est refusée, et un changement de rôle vers
 * l'un d'eux efface celle qu'il portait, sans quoi elle ressusciterait au
 * premier retour à un autre rôle.
 */
export const ROLES_SANS_LOGICIELS: readonly string[] = ['ADMIN_CABINET', 'GESTIONNAIRE_PAIE'];
