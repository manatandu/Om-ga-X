/**
 * LIGNE SAGE-L5, FONCTION 88 · ce que l'écran de la répartition analytique
 * du salarié lit du serveur, et la lecture des pourcentages tapés. La règle
 * (somme à 100 %, sections Détail actives du plan, plan qui ventile la
 * classe 6) se juge au serveur (`ventilation-analytique-paie.ts`) · l'écran
 * ne fait que dire le total avant l'envoi.
 */

export interface SectionDeRepartition {
  id: string;
  code: string;
  intitule: string;
}

export interface PlanDeRepartition {
  id: string;
  code: string;
  intitule: string;
  /** Le plan ventile la classe 6 · sinon il ne reçoit pas de répartition de la paie. */
  ventileLaPaie: boolean;
  sections: SectionDeRepartition[];
  sectionsTronquees: boolean;
}

export interface VersionDeRepartition {
  id: string;
  planId: string;
  planCode: string;
  planIntitule: string;
  moisEffet: string;
  createdAt: string;
  retireLe: string | null;
  motifRetrait: string | null;
  lignes: { sectionId: string; sectionCode: string; sectionIntitule: string; pourcentage: number }[];
}

export interface RepartitionsLues {
  plans: PlanDeRepartition[];
  plansTronques: boolean;
  versions: VersionDeRepartition[];
  total: number;
  tronque: boolean;
  /**
   * Ligne paie-suite · la section que l'unité de l'organigramme du salarié
   * PROPOSE au jour, avec son motif · null sans rattachement.
   */
  propositionOrganigramme?: {
    unite: { code: string; intitule: string };
    section: { id: string; code: string; intitule: string; planId: string } | null;
    motif: string;
  } | null;
}

/**
 * Un pourcentage tapé (« 60 », « 33,33 », « 33.34 ») · `null` s'il est
 * illisible ou porte plus de deux décimales, pour que l'écran le DISE au lieu
 * de l'arrondir.
 */
export function lirePourcentage(texte: string): number | null {
  const t = texte.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

/** Le total en points de base (100 % = 10 000) · `null` dès qu'un pourcentage est illisible. */
export function totalEnPointsDeBase(textes: readonly string[]): number | null {
  let total = 0;
  for (const t of textes) {
    const p = lirePourcentage(t);
    if (p === null) return null;
    total += Math.round(p * 100);
  }
  return total;
}
