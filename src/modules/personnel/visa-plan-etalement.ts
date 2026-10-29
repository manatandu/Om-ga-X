/**
 * LIGNE PAIE-SUITE · LE VISA D'UN PLAN D'ÉTALEMENT PAR UN SECOND UTILISATEUR
 * (gel levé par Manasse le 2026-10-29, `docs/plan-gel-leve-2026-10-29.md`,
 * § 3, idée de Microfina++).
 *
 * POURQUOI. Le plan d'étalement d'une avance ou d'un prêt (avances-salaire.ts)
 * fait PROPOSER au bulletin, chaque mois, la retenue de l'art. 112, c) et f)
 * du Code du travail. Un plan saisi de travers (une échéance de 500 000 au
 * lieu de 50 000) fait préremplir au bulletin une retenue que personne n'a
 * convenue · le visa met un second regard entre la saisie du plan et le
 * bulletin qui le propose.
 *
 * PAR LA LOI · aucun texte lu n'impose un tel visa. L'art. 112 autorise les
 * retenues sans fixer ni durée ni échéance (le plan est une convention que le
 * cabinet déclare) ; l'AUDCIF art. 69 laisse à l'entité « les procédures
 * nécessaires » (SYSCOHADA), le SYCEBNL les demande par son art. 16, 2),
 * l'art. 69 lui étant exclu par son art. 3. C'est donc une OPTION du dossier
 * (`Tenant.visaPlansEtalement`), désactivée par défaut, MÊME MODÈLE QUE LE
 * VISA DES RIB (`tiers/visa-rib.ts`) · l'imposer d'office fermerait les
 * retenues étalées du cabinet à un seul utilisateur.
 *
 * CINQ RÈGLES, celles du visa des RIB transposées.
 * (1) LE VISA PORTE SUR LE PLAN, et sur lui seul · premier mois, nombre
 *     d'échéances, retenue mensuelle. L'objet, la pièce et le montant consenti
 *     ne se changent pas après la saisie (aucune route ne le permet).
 * (2) TOUTE SAISIE DU PLAN LE FAIT TOMBER et nomme son auteur (`planSaisiPar`,
 *     `planSaisiLe`) · la création avec un plan comprise. Retirer le plan
 *     efface les quatre traces · il n'y a plus rien à viser.
 * (3) L'AUTEUR NE VISE PAS SON PROPRE PLAN · le logiciel contrôle l'IDENTITÉ,
 *     jamais l'indépendance. Un plan d'avant la règle n'a pas d'auteur connu ·
 *     tout utilisateur admis le vise, et la réponse le DIT.
 * (4) LE VISA VISE CE QUI A ÉTÉ LU · l'écran renvoie l'instant de la saisie
 *     qu'il a montrée, et le serveur refuse (409) un plan changé depuis.
 * (5) L'OPTION NE JOUE QU'À LA PROPOSITION · activée, un plan non visé n'est
 *     PAS proposé au bulletin, et la simulation le DIT (avec l'issue) · jamais
 *     un silence qui ferait croire que l'avance est soldée. Rien n'est refusé
 *     au bulletin · la retenue saisie à la main reste celle que la saisie
 *     porte (avances-salaire.ts, « proposée, jamais substituée »).
 */

/** Ce que le visa couvre · un changement de l'un de ces champs le fait tomber (règle 1). */
export const CHAMPS_DU_PLAN_VISES = ['premierMoisRetenue', 'nombreEcheances', 'retenueMensuelleFc'] as const;

export interface EtatVisaPlan {
  planSaisiPar: string | null;
  planSaisiLe: Date | null;
  planVisePar: string | null;
  planViseLe: Date | null;
}

type Plan = { premierMoisRetenue: string | null; nombreEcheances: number | null; retenueMensuelleFc: number | null };

/** Le plan a-t-il changé · une absence et un vide disent la même chose, deux montants se comparent au centime. */
export function planChange(avant: Plan, apres: Plan): boolean {
  const c = (n: number | null) => (n === null ? null : Math.round(n * 100));
  return (
    (avant.premierMoisRetenue ?? null) !== (apres.premierMoisRetenue ?? null) ||
    (avant.nombreEcheances ?? null) !== (apres.nombreEcheances ?? null) ||
    c(avant.retenueMensuelleFc ?? null) !== c(apres.retenueMensuelleFc ?? null)
  );
}

/** Visé · les deux traces posées. Une trace absente (requête trop étroite) n'est pas un visa. */
export function planVise(a: Partial<EtatVisaPlan>): boolean {
  return typeof a.planVisePar === 'string' && a.planVisePar !== '' && a.planViseLe instanceof Date;
}

/** Ce qu'une saisie du plan écrit (règle 2) · sans plan, les traces s'effacent. */
export function saisieDuPlan(utilisateurId: string, maintenant: Date, avecPlan: boolean): EtatVisaPlan {
  return avecPlan
    ? { planSaisiPar: utilisateurId, planSaisiLe: maintenant, planVisePar: null, planViseLe: null }
    : { planSaisiPar: null, planSaisiLe: null, planVisePar: null, planViseLe: null };
}

export const MOTIF_VISA_PLAN_PAR_SON_AUTEUR =
  "Vous avez saisi ou changé ce plan d'étalement en dernier · un autre administrateur ou comptable du dossier doit le viser. C'est le second regard que l'option « Visa des plans d'étalement » demande avant que le bulletin propose la retenue.";

export const MOTIF_PLAN_CHANGE_DEPUIS_LA_LECTURE =
  "Ce plan d'étalement a été changé depuis que vous l'avez ouvert · relisez-le avant de le viser.";

export const AVERTISSEMENT_PLAN_AUTEUR_INCONNU =
  "Ce plan a été déclaré avant le visa des plans d'étalement · son auteur n'est pas connu d'OmegaX, qui n'a donc pas pu vérifier que vous n'en êtes pas l'auteur.";

/** Le refus de viser, ou null · `saisiLeLu` est l'instant que l'écran a montré, null pour un plan sans saisie connue. */
export function motifRefusVisaPlan(a: EtatVisaPlan & { premierMoisRetenue: string | null }, utilisateurId: string, saisiLeLu: string | null): string | null {
  if (!a.premierMoisRetenue) return "Cette avance ne porte aucun plan d'étalement · il n'y a rien à viser.";
  const enBase = a.planSaisiLe === null ? null : a.planSaisiLe.toISOString();
  if (enBase !== saisiLeLu) return MOTIF_PLAN_CHANGE_DEPUIS_LA_LECTURE;
  if (planVise(a)) return "Ce plan est déjà visé · il ne se vise qu'une fois par saisie.";
  if (a.planSaisiPar !== null && a.planSaisiPar === utilisateurId) return MOTIF_VISA_PLAN_PAR_SON_AUTEUR;
  return null;
}

/**
 * Le plan se propose-t-il au bulletin · toujours sans l'option, seulement visé
 * avec elle. `null` quand il se propose, sinon la phrase que la simulation dit
 * (règle 5).
 */
export function motifPlanNonPropose(exige: boolean, a: Partial<EtatVisaPlan>, libelle: string): string | null {
  if (!exige || planVise(a)) return null;
  return (
    `${libelle} · le plan d'étalement n'est pas visé, et le dossier exige le visa des plans (Paramètres du dossier) · ` +
    "sa retenue n'est pas proposée ce mois-ci. Un administrateur ou un comptable autre que celui qui l'a saisi le vise " +
    "(Rubriques et avances), ou portez la retenue à la main."
  );
}
