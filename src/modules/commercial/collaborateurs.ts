import { TypeTiers } from '@prisma/client';

/**
 * LIGNE commercial-l8, fonction 91 · LES COLLABORATEURS ET LEURS RÔLES
 * COMMERCIAUX (Sage, F_COLLABORATEUR). Aucun texte lu ne régit cette
 * structure · c'est l'organisation du dossier. Un collaborateur N'EST PAS un
 * utilisateur · ses rôles ne donnent aucun droit dans OmegaX, ils ne servent
 * qu'à NOMMER qui suit un tiers (représentant) ; les droits restent ceux du
 * rôle de l'utilisateur (`common/guards/roles-cantonnes.ts`).
 */

export const ROLES_COLLABORATEUR = ['vendeur', 'caissier', 'acheteur', 'controleur', 'financier', 'recouvrement'] as const;
export type RoleCollaborateur = (typeof ROLES_COLLABORATEUR)[number];

export const LIBELLES_ROLES: Readonly<Record<RoleCollaborateur, string>> = {
  vendeur: 'vendeur',
  caissier: 'caissier',
  acheteur: 'acheteur',
  controleur: 'contrôleur',
  financier: 'financier',
  recouvrement: 'chargé de recouvrement',
};

/**
 * LE RÔLE QU'EXIGE LA REPRÉSENTATION D'UN TIERS · un vendeur suit un client
 * (ou un adhérent qui achète), un acheteur un fournisseur. Un salarié ou un
 * « autre » tiers n'a pas de représentant commercial.
 */
export function roleExigePour(type: TypeTiers): RoleCollaborateur | null {
  if (type === TypeTiers.CLIENT || type === TypeTiers.ADHERENT) return 'vendeur';
  if (type === TypeTiers.FOURNISSEUR) return 'acheteur';
  return null;
}

export function motifRefusRepresentant(
  typeTiers: TypeTiers,
  c: { nom: string; prenom: string | null; actif: boolean } & Record<RoleCollaborateur, boolean>,
): string | null {
  const role = roleExigePour(typeTiers);
  const qui = [c.prenom, c.nom].filter(Boolean).join(' ');
  if (!role) return 'Ce type de tiers n’a pas de représentant commercial · seuls un client, un adhérent ou un fournisseur en reçoivent un.';
  if (!c.actif) return `${qui} est en sommeil · il ne représente plus de tiers.`;
  if (!c[role]) return `${qui} n’a pas le rôle de ${LIBELLES_ROLES[role]} · il ne représente pas ce type de tiers. Cochez ce rôle sur sa fiche (Structure > Gestion commerciale > Collaborateurs).`;
  return null;
}

/** Le nom · exigé, 35 caractères au plus, comme chez Sage. */
export function motifRefusNomCollaborateur(nom: string): string | null {
  const t = nom.trim();
  if (!t) return 'Le nom du collaborateur est exigé.';
  if ([...t].length > 35) return 'Le nom du collaborateur compte au plus 35 caractères.';
  return null;
}
