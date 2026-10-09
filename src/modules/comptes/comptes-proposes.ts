import { TypeCompteDetailTotal } from '@prisma/client';
import { identifiantsUtilises } from '../../common/suppression/references';

/**
 * LES COMPTES PROPOSÉS · décision de Manasse du 2026-09-28 (CLAUDE.md,
 * « Comptes retenus »). Une LISTE DE CHOIX ne propose que les comptes que le
 * cabinet a RETENUS et ceux déjà UTILISÉS ; les états, les imports et les
 * écritures automatiques lisent tout le plan. Depuis le 2026-10-09, la même
 * règle dit le compte PERSONNALISÉ, et elle REFUSE · la saisie, la
 * réimputation, la fusion, un modèle de saisie, un abonnement, le rattachement
 * à un tiers ou à un journal n'admettent qu'un compte personnalisé (voir
 * `comptesNonPersonnalises` plus bas).
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
export const LIENS_QUI_NE_RETIENNENT_PAS = [
  'Compte.collectifId',
  // LES LIENS QUI LISENT UN COMPTE SANS Y PASSER D'ÉCRITURE (relecture du
  // 2026-10-09) · le rattachement d'une rubrique de note, la fiche d'un
  // comptage, une provision tenue au registre, une demande de confirmation,
  // le procès-verbal d'une caisse, une relance, une OD analytique. Chacun
  // rendait le compte utilisé, donc personnalisé d'office, et ouvrait à la
  // saisie un compte que l'administrateur n'a jamais adopté, par un geste
  // qui n'en est pas une. L'écart d'inventaire, lui, retient · c'est le
  // module qui le redresse.
  'RattachementNote.compteId',
  'FicheInventaire.compteId',
  'ProvisionRisqueCharge.compteId',
  'DemandeConfirmation.compteId',
  'ProcesVerbalComptageCaisse.compteId',
  'Relance.compteId',
  'OdAnalytique.compteId',
];

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
 * la FACULTÉ d'ouvrir « toutes subdivisions nécessaires », et le SYCEBNL, dont
 * l'art. 3 écarte cet art. 18, dit à sa Partie 2 ch. 2, section 1, que le plan
 * « peut être complété par des codes établis en fonction des besoins ». C'est
 * une règle d'organisation d'OmegaX, et le refus le dit sans citer d'article.
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
    where: { tenantId, id: { in: uniques }, estRetenu: false, typeCompte: TypeCompteDetailTotal.DETAIL },
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
    'Personnalisez-le d\'abord dans Plan comptable (geste de l\'administrateur du dossier) · adoptez le compte du plan tel ' +
    'quel, ou ouvrez un sous-compte sous lui.'
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
