/**
 * LES LISTES DE CHOIX DE COMPTES · décision de Manasse du 2026-09-28
 * (CLAUDE.md, « Comptes retenus »). Une liste de choix ne propose que les
 * comptes RETENUS par le cabinet et ceux déjà UTILISÉS ; c'est le SERVEUR qui
 * applique la règle (`src/modules/comptes/comptes-proposes.ts`), sur demande
 * du paramètre `retenus=true`, pour `/comptes` comme pour les routes des
 * immobilisations. L'écran n'en recopie rien · il demande, puis dit ce que la
 * règle a fait quand la liste revient vide (§ 9 ter · « une liste qui dépend
 * d'un choix dit pourquoi elle est vide et ce qu'il faut faire d'abord »).
 *
 * AUCUN IMPORT DE REACT · ce module est lu par des specs (`regle-par.ts`),
 * et le jest de la racine tourne sans le client installé
 * (`specs-sans-react.spec.ts`) ; le crochet de présélection vit dans
 * `preselection-unique.ts`.
 *
 * LE COMPTE PROPOSÉ EST LE COMPTE PERSONNALISÉ (décision de Manasse du
 * 2026-10-09) · seul il se saisit, se réimpute et se rattache à un tiers ou à
 * un journal ; le serveur refuse les autres en les nommant. Les états, les
 * imports et les écritures que le logiciel calcule lisent tout le plan, et
 * le compte qu'ils mouvementent devient personnalisé d'office.
 */

/** Le paramètre de requête, le même pour toutes les routes de la liste du serveur. */
export const RETENUS = 'retenus=true';

/**
 * Pourquoi une liste de choix de comptes est vide, et ce qu'il faut faire.
 * `null` tant que la liste n'est pas lue (null n'est pas vide) ou qu'elle ne
 * l'est pas. `nature` nomme ce que la liste attend (« de trésorerie »,
 * « 29 de la division du bien »…), pour que le message dise QUEL compte
 * retenir.
 */
export function motifAucunCompteRetenu(liste: readonly unknown[] | null | undefined, nature: string): string | null {
  if (!liste || liste.length > 0) return null;
  return `Aucun compte ${nature} personnalisé · l'administrateur du dossier le personnalise dans Plan comptable (ou l'ouvre s'il manque au plan).`;
}

/** Le seul compte d'une liste, à présélectionner ; chaîne vide sinon. */
export function compteUnique(liste: readonly { id: string }[] | null | undefined): string {
  return liste && liste.length === 1 ? liste[0].id : '';
}

/**
 * LE COMPTE D'UN NUMÉRO TAPÉ EN ENTIER, cherché dans le plan reçu · la saisie
 * le cherche dans tout le plan pour NOMMER un compte non personnalisé (il ne
 * se prend pas), l'inventaire, qui compte et ne saisit pas, pour le prendre.
 */
export function compteDuNumeroTape<C extends { numero: string }>(saisie: string, plan: readonly C[]): C | undefined {
  const numero = saisie.trim();
  if (!numero) return undefined;
  return plan.find((c) => c.numero === numero);
}

/**
 * Ce que la liste de saisie montre pour une frappe · les comptes PROPOSÉS
 * (retenus ou utilisés) qui commencent par le numéro ou portent l'intitulé,
 * et en tête le compte du plan dont le numéro est tapé en entier s'il n'est
 * pas proposé (`horsListe`, pour que l'écran le dise sans le refuser).
 */
export function comptesPourLaFrappe<C extends { id: string; numero: string; intitule: string }>(
  saisie: string,
  proposes: readonly C[],
  plan: readonly C[],
  limite = 14,
): { compte: C; horsListe: boolean }[] {
  const q = saisie.trim().toLowerCase();
  const trouves = (q ? proposes.filter((c) => c.numero.startsWith(q) || c.intitule.toLowerCase().includes(q)) : proposes)
    .slice(0, limite)
    .map((compte) => ({ compte, horsListe: false }));
  const exact = compteDuNumeroTape(saisie, plan);
  if (exact && !proposes.some((c) => c.id === exact.id)) return [{ compte: exact, horsListe: true }, ...trouves].slice(0, limite);
  return trouves;
}
