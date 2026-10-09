import { identifiantsUtilises } from '../../common/suppression/references';

/**
 * LES COMPTES PROPOSÉS · décision de Manasse du 2026-09-28 (CLAUDE.md,
 * « Comptes retenus »). Une LISTE DE CHOIX ne propose que les comptes que le
 * cabinet a RETENUS et ceux déjà UTILISÉS ; les états, les imports et les
 * écritures automatiques lisent tout le plan, et rien n'est jamais refusé au
 * motif qu'un compte n'est pas retenu.
 *
 * UN SEUL CALCUL · `identifiantsUtilises` (relations lues dans le schéma) et
 * `Compte.estRetenu`, appelés ici et nulle part ailleurs. Chaque route qui sert
 * une liste de comptes passe par `comptesProposes`, sans quoi une route
 * nouvelle filtrerait à sa façon (ou pas du tout) et la règle divergerait
 * d'une fenêtre à l'autre sans que rien ne le dise.
 */

/**
 * Le lien d'un compte individuel vers son collectif n'est pas un USAGE du
 * collectif · un collectif ne se saisit pas à la place de ses tiers, il ne
 * reste donc pas proposé pour ce seul motif.
 */
const LIENS_QUI_NE_RETIENNENT_PAS = ['Compte.collectifId'];

/** Parmi `ids`, les comptes auxquels quoi que ce soit se réfère. */
export function comptesUtilises(prisma: unknown, tenantId: string, ids: string[]): Promise<Set<string>> {
  return identifiantsUtilises(prisma, 'Compte', ids, tenantId, LIENS_QUI_NE_RETIENNENT_PAS);
}

/** LA RÈGLE elle-même · retenu par le cabinet, ou utilisé quelque part. */
export function estPropose(c: { id: string; estRetenu: boolean }, utilises: Set<string>): boolean {
  return c.estRetenu || utilises.has(c.id);
}

/**
 * Les comptes d'une liste de choix · retenus ou utilisés, dans l'ordre reçu.
 * `ecartes` compte ceux que la règle retire, pour que l'écran dise qu'une
 * liste vide l'est faute de compte RETENU (« retenez-le dans Plan
 * comptable ») et non faute de compte au plan.
 */
export async function comptesProposes<C extends { id: string; estRetenu: boolean }>(
  prisma: unknown,
  tenantId: string,
  comptes: C[],
): Promise<{ proposes: C[]; ecartes: number }> {
  const aVerifier = comptes.filter((c) => !c.estRetenu).map((c) => c.id);
  const utilises = await comptesUtilises(prisma, tenantId, aVerifier);
  const proposes = comptes.filter((c) => estPropose(c, utilises));
  return { proposes, ecartes: comptes.length - proposes.length };
}

/**
 * LE COMPTE PERSONNALISÉ (décision de Manasse du 2026-10-09 · « seuls les
 * numéros personnalisés sont ceux qui s'affichent et permettent de passer les
 * écritures »). Personnalisé = la règle ci-dessus, et elle seule · RETENU par
 * le cabinet, qui a ADOPTÉ un compte du plan officiel (même numéro, son
 * intitulé) ou l'a CRÉÉ (un sous-compte, le compte d'un tiers ou d'un
 * journal), ou UTILISÉ, c'est-à-dire adopté D'OFFICE · par l'écriture qu'un
 * module y passe (paie, TVA, clôture, impôt, amortissements), par un journal,
 * un tiers, un taux de taxe ou une famille d'immobilisations qui le porte.
 * Aucun texte n'impose la règle · l'AUDCIF, art. 18, al. 3, laisse à l'entité
 * la FACULTÉ d'ouvrir « toutes subdivisions nécessaires ». C'est une règle
 * d'organisation d'OmegaX, et le refus le dit sans citer d'article.
 *
 * Seuls les comptes d'IMPUTATION sont jugés · un compte Total est refusé à
 * la saisie par sa propre règle (`controlesDEntree`), jamais par celle-ci.
 */
export async function comptesNonPersonnalises(
  prisma: unknown,
  tenantId: string,
  ids: string[],
): Promise<{ id: string; numero: string; intitule: string }[]> {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return [];
  const p = prisma as {
    compte: {
      findMany: (a: unknown) => Promise<{ id: string; numero: string; intitule: string; estRetenu: boolean; typeCompte: string }[]>;
    };
  };
  const comptes = await p.compte.findMany({
    where: { tenantId, id: { in: uniques }, estRetenu: false, typeCompte: 'DETAIL' },
    select: { id: true, numero: true, intitule: true, estRetenu: true, typeCompte: true },
    orderBy: { numero: 'asc' },
  });
  if (comptes.length === 0) return [];
  const utilises = await comptesUtilises(prisma, tenantId, comptes.map((c) => c.id));
  return comptes.filter((c) => !estPropose(c, utilises)).map(({ id, numero, intitule }) => ({ id, numero, intitule }));
}

/** Le refus nommé · le ou les comptes, et le geste qui lève le refus. */
export function motifComptesNonPersonnalises(comptes: { numero: string; intitule: string }[], geste: string): string | null {
  if (comptes.length === 0) return null;
  const noms = comptes.slice(0, 5).map((c) => `${c.numero} ${c.intitule}`).join(', ');
  const suite = comptes.length > 5 ? ` et ${comptes.length - 5} autre(s)` : '';
  return (
    `Compte non personnalisé : ${noms}${suite} · ${geste} ne se fait que sur un compte personnalisé du dossier. ` +
    'Personnalisez-le d\'abord dans Plan comptable · adoptez le compte du plan tel quel, ou ouvrez un sous-compte sous lui.'
  );
}

/*
  La liste des routes qui servent une liste de choix vit dans
  `listes-de-comptes.ts`, un module SANS IMPORT · le spec de l'écran
  (`client/src/lib/comptes-retenus-ecrans.spec.ts`) l'importe tel quel, et
  il ne peut pas charger Prisma.
*/
export {
  LISTES_DE_COMPTES,
  PARAMETRE_RETENUS,
  ROUTES_QUI_NE_SONT_PAS_DES_LISTES,
  type RegimeListeDeComptes,
} from './listes-de-comptes';
