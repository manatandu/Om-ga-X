/**
 * LIGNE PAIE-SUITE · DÉPARTEMENTS ET DIRECTIONS · l'organigramme du dossier et
 * le rattachement daté de chaque salarié. Règles pures, sans Prisma.
 *
 * PAR LA LOI (`docs/plan-gel-leve-2026-10-29.md`, § 2) · aucun texte lu ne fixe
 * l'organisation interne d'une entité. Le Code du travail, art. 212, ne demande
 * au contrat que « la nature et les modalités du travail à fournir » (8°) et
 * « le ou les lieux d'exécution du contrat » (10°) · aucun texte ne nomme une
 * direction ou un service, et chaque entreprise a les siens. (Le plan du
 * 2026-10-29, § 2, écrivait « l'emploi occupé » · relu au texte, corrigé.) OmegaX ne pose donc AUCUNE liste ni AUCUN niveau ·
 *  - l'organigramme est un ARBRE LIBRE · une unité a un code, un intitulé, un
 *    NIVEAU que le dossier nomme lui-même (« Direction », « Département »,
 *    « Service », ou ce qu'il veut) et une unité parente, sans limite de
 *    profondeur ;
 *  - un salarié est RATTACHÉ à une unité avec une DATE D'EFFET, l'historique
 *    gardé · une mutation n'efface rien, une saisie fausse s'ANNULE avec son
 *    motif et reste lue ;
 *  - une unité peut renvoyer à une SECTION ANALYTIQUE, que la répartition
 *    analytique de la paie PROPOSE alors, jamais imposée (fonction 88,
 *    `ventilation-analytique-paie.ts`) ;
 *  - une unité qui porte un rattachement, ou des unités filles, ne se supprime
 *    pas · elle se met en SOMMEIL, et ne reçoit plus de rattachement nouveau.
 */

export const LONGUEUR_CODE_UNITE = 20;
export const LONGUEUR_INTITULE_UNITE = 120;
export const LONGUEUR_NIVEAU_UNITE = 40;
/** Convention d'OmegaX · un organigramme lu d'un coup, au-delà la liste se dit tronquée. */
export const PLAFOND_UNITES = 2_000;
/** L'historique d'un salarié · au-delà, la lecture le dit. */
export const PLAFOND_HISTORIQUE = 500;

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function motifRefusUnite(u: { code?: string; intitule?: string; niveau?: string | null }): string | null {
  const code = (u.code ?? '').trim();
  const intitule = (u.intitule ?? '').trim();
  if (!code) return "Le code de l'unité est obligatoire.";
  if (code.length > LONGUEUR_CODE_UNITE) return `Le code de l'unité tient en ${LONGUEUR_CODE_UNITE} caractères au plus.`;
  if (!CODE_RE.test(code)) return "Le code de l'unité s'écrit en lettres et chiffres, avec point, tiret ou trait bas, sans espace.";
  if (!intitule) return "L'intitulé de l'unité est obligatoire.";
  if (intitule.length > LONGUEUR_INTITULE_UNITE) return `L'intitulé tient en ${LONGUEUR_INTITULE_UNITE} caractères au plus.`;
  if ((u.niveau ?? '').trim().length > LONGUEUR_NIVEAU_UNITE) return `Le niveau tient en ${LONGUEUR_NIVEAU_UNITE} caractères au plus.`;
  return null;
}

/**
 * UNE UNITÉ NE DESCEND PAS D'ELLE-MÊME · placer une unité sous l'une de ses
 * filles (ou sous elle-même) ferait de l'organigramme une boucle, que l'écran
 * ne saurait plus dérouler. La remontée est bornée par le nombre d'unités ·
 * un cycle déjà en base (jamais écrit par OmegaX) ne fait pas tourner sans fin.
 */
export function formeUnCycle(uniteId: string, nouveauParentId: string | null, parentDe: ReadonlyMap<string, string | null>): boolean {
  let courant = nouveauParentId;
  for (let i = 0; courant !== null && i <= parentDe.size + 1; i++) {
    if (courant === uniteId) return true;
    courant = parentDe.get(courant) ?? null;
  }
  return courant !== null;
}

export type UnitePourArbre = { id: string; code: string; parentId: string | null };

/**
 * L'ORDRE DE L'ARBRE · chaque unité sous sa parente, les sœurs par code, avec
 * sa profondeur et son chemin de codes. Une unité dont la parente n'est pas
 * lue (liste tronquée) se range à la racine, et c'est dit (`orpheline`).
 */
export function deroulerArbre<T extends UnitePourArbre>(unites: readonly T[]): (T & { profondeur: number; chemin: string[]; orpheline: boolean })[] {
  const ids = new Set(unites.map((u) => u.id));
  const enfants = new Map<string | null, T[]>();
  for (const u of unites) {
    const cle = u.parentId !== null && ids.has(u.parentId) ? u.parentId : null;
    enfants.set(cle, [...(enfants.get(cle) ?? []), u]);
  }
  for (const liste of enfants.values()) liste.sort((a, b) => a.code.localeCompare(b.code));
  const sortie: (T & { profondeur: number; chemin: string[]; orpheline: boolean })[] = [];
  const vus = new Set<string>();
  const descendre = (parent: string | null, profondeur: number, chemin: string[]) => {
    for (const u of enfants.get(parent) ?? []) {
      if (vus.has(u.id)) continue;
      vus.add(u.id);
      const c = [...chemin, u.code];
      sortie.push({ ...u, profondeur, chemin: c, orpheline: u.parentId !== null && !ids.has(u.parentId) });
      descendre(u.id, profondeur + 1, c);
    }
  };
  descendre(null, 0, []);
  // Une boucle déjà en base n'est jamais atteinte depuis la racine · ses unités
  // sont rendues quand même, à la racine, plutôt que tues.
  for (const u of unites) if (!vus.has(u.id)) sortie.push({ ...u, profondeur: 0, chemin: [u.code], orpheline: true });
  return sortie;
}

export type RattachementLu = { id: string; uniteId: string; dateEffet: Date; annuleLe: Date | null };

/**
 * L'UNITÉ D'UN SALARIÉ À UNE DATE · le rattachement non annulé de date d'effet
 * la plus récente au plus tard ce jour-là. `null` avant le premier
 * rattachement · jamais une unité présumée.
 */
export function rattachementALaDate<R extends RattachementLu>(rattachements: readonly R[], date: Date): R | null {
  let retenu: R | null = null;
  for (const r of rattachements) {
    if (r.annuleLe !== null || r.dateEffet.getTime() > date.getTime()) continue;
    if (!retenu || r.dateEffet.getTime() > retenu.dateEffet.getTime()) retenu = r;
  }
  return retenu;
}

/**
 * Le refus d'un rattachement · unité en sommeil, deux rattachements actifs du
 * même salarié à la même date (lequel vaudrait ?), le même rattachement que
 * celui déjà en vigueur à cette date (il n'ajoute rien à l'historique).
 */
export function motifRefusRattachement(
  unite: { code: string; estActive: boolean },
  dateEffet: Date,
  existants: readonly RattachementLu[],
  uniteId: string,
): string | null {
  if (!unite.estActive) return `L'unité ${unite.code} est en sommeil · elle ne reçoit plus de rattachement. Réactivez-la, ou rattachez le salarié à une autre unité.`;
  const iso = dateEffet.toISOString().slice(0, 10);
  if (existants.some((r) => r.annuleLe === null && r.dateEffet.getTime() === dateEffet.getTime())) {
    return `Ce salarié a déjà un rattachement daté du ${iso} · annulez-le avant d'en saisir un autre à la même date.`;
  }
  const enVigueur = rattachementALaDate(existants, dateEffet);
  if (enVigueur && enVigueur.uniteId === uniteId) {
    return `Ce salarié est déjà rattaché à l'unité ${unite.code} à la date du ${iso} · le rattachement n'ajouterait rien à son historique.`;
  }
  return null;
}

/** Une unité ne se supprime que vierge · sinon elle se met en sommeil, l'historique restant lisible. */
export function motifRefusSuppressionUnite(u: { code: string; rattachements: number; enfants: number }): string | null {
  if (u.rattachements > 0) {
    return `L'unité ${u.code} porte ${u.rattachements} rattachement(s), annulés compris · elle ne se supprime pas, l'historique des salariés la nomme. Mettez-la en sommeil.`;
  }
  if (u.enfants > 0) {
    return `L'unité ${u.code} a ${u.enfants} unité(s) rattachée(s) sous elle · déplacez-les ou mettez-la en sommeil.`;
  }
  return null;
}

export const FONDEMENT_ORGANIGRAMME =
  "Aucun texte n'impose une organisation interne · le Code du travail, art. 212, ne demande au contrat que la nature et les modalités du travail et ses lieux d'exécution. L'organigramme est celui que le dossier décrit, ses niveaux nommés par lui.";
