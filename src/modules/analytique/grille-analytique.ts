/**
 * LIGNE ANALYTIQUE, FONCTION N° 48 · LA GRILLE ANALYTIQUE D'UN COMPTE.
 *
 * Sage (manuel 1, ligne 19 ; manuel 13, ligne 60) rattache au compte général
 * une grille qui répartit ses lignes entre des sections, en pourcentages.
 * AUCUN TEXTE NE LA RÉGIT · la comptabilité analytique est « laissée à
 * l'initiative des entités » (SYCEBNL, Partie 2 ch. 3, classe 9,
 * sous-section 2 ; AUDCIF, Titre VII ch. 3, classe 9, sous-section 2). La
 * grille, ses pourcentages et l'arrondi sont des CONVENTIONS D'OMEGAX, dites
 * dans la bulle. Ce qui ne se discute pas vient des règles de ventilation
 * existantes (`od-analytique.ts`, `EcritureService.verifierSectionsVentilees`)
 * · sections Détail actives du plan, plan qui ventile la classe du compte,
 * ligne ventilée en totalité sur un plan ou pas du tout.
 *
 * PROPOSÉE, JAMAIS IMPOSÉE · la saisie la propose quand le compte est choisi,
 * et le comptable la garde, la remplace par une section ou l'écarte. Ni le
 * serveur à la saisie, ni les modules, ni les imports ne l'appliquent d'office
 * · une ventilation qu'on n'a pas vue poser se lit comme une décision prise.
 *
 * AU CENTIME, PAR LE PLUS FORT RESTE, comme la ventilation de la paie
 * (`personnel/ventilation-analytique-paie.ts`) · les parts exactes (centimes ×
 * points de base) se tronquent, et les centimes qui manquent vont aux plus
 * forts restes, à égalité par le code de la section. La somme égale la ligne
 * au centime, ce que la saisie exige. La même règle est recopiée à l'écran
 * (`client/src/lib/grille-analytique.ts`) et tenue en MIROIR · les deux specs
 * rejouent les cas de `cas-grille-analytique.json`.
 *
 * UNE GRILLE QUI NE S'APPLIQUE PLUS SE DIT · une section passée en sommeil,
 * devenue rubrique, ou un plan en sommeil, et la grille n'est pas proposée,
 * la cause nommée (`motifGrilleInapplicable`) · rien n'est reporté au prorata
 * des autres sections, ce serait porter sur une section une charge qu'elle
 * n'a pas.
 */
import { motifRefusClasseVentilee } from './od-analytique';

/** Au plus cinquante sections par grille · borne de saisie, convention d'OmegaX (comme la paie). */
export const PLAFOND_LIGNES_GRILLE = 50;

export type LigneGrille = { readonly sectionId: string; readonly pourcentage: number };

export type PlanDeGrille = { readonly id: string; readonly code: string; readonly classesVentilees: string; readonly estActif: boolean };

export type CompteDeGrille = { readonly numero: string; readonly classe: string; readonly estTotal: boolean };

export type SectionDeGrille = {
  readonly id: string;
  readonly planId: string;
  readonly code: string;
  readonly estTotal: boolean;
  readonly estActive: boolean;
};

/** Le pourcentage en points de base (60,25 % → 6 025), `null` au-delà de deux décimales. */
export function enPointsDeBase(pourcentage: number): number | null {
  if (!Number.isFinite(pourcentage)) return null;
  const points = Math.round(pourcentage * 100);
  return Math.abs(points - pourcentage * 100) < 1e-6 ? points : null;
}

/** Le refus d'une grille déclarée, ou `null`. Une grille VIDE n'existe pas · on la retire. */
export function motifRefusGrille(params: {
  readonly plan: PlanDeGrille | null;
  readonly compte: CompteDeGrille | null;
  readonly sections: readonly SectionDeGrille[];
  readonly lignes: readonly LigneGrille[];
}): string | null {
  const { plan, compte, sections, lignes } = params;
  if (!compte) return 'Compte introuvable dans ce dossier.';
  if (compte.estTotal) {
    return `Le compte ${compte.numero} est un compte de regroupement · une grille se rattache à un compte de détail, qui reçoit les lignes saisies.`;
  }
  if (!plan) return 'Plan analytique introuvable dans ce dossier.';
  if (!plan.estActif) return `Le plan ${plan.code} est en sommeil · il ne reçoit plus de ventilation.`;
  const refusClasse = motifRefusClasseVentilee(compte.classe, plan.classesVentilees);
  if (refusClasse) return `Plan ${plan.code} · ${refusClasse}`;
  if (lignes.length === 0) return 'Une grille porte au moins une section · pour ne plus en avoir, retirez-la.';
  if (lignes.length > PLAFOND_LIGNES_GRILLE) return `Une grille porte au plus ${PLAFOND_LIGNES_GRILLE} sections.`;
  const vues = new Set<string>();
  let points = 0;
  for (const [i, l] of lignes.entries()) {
    const s = sections.find((x) => x.id === l.sectionId);
    if (!s || s.planId !== plan.id) return `Ligne ${i + 1} · la section n'appartient pas au plan ${plan.code}.`;
    if (s.estTotal) return `Ligne ${i + 1} · ${s.code} est une rubrique (section Total) · elle totalise ses sections, elle ne reçoit rien.`;
    if (!s.estActive) return `Ligne ${i + 1} · la section ${s.code} est en sommeil.`;
    if (vues.has(s.id)) return `Ligne ${i + 1} · la section ${s.code} est déjà dans la grille.`;
    vues.add(s.id);
    const p = enPointsDeBase(l.pourcentage);
    if (p === null) return `Ligne ${i + 1} · pourcentage illisible (deux décimales au plus).`;
    if (p <= 0 || p > 10_000) return `Ligne ${i + 1} · un pourcentage est strictement positif et au plus 100.`;
    points += p;
  }
  if (points !== 10_000) {
    return `Les pourcentages font ${(points / 100).toFixed(2)} % · une grille fait exactement 100 %, sans quoi une part de la ligne ne serait portée par aucune section.`;
  }
  return null;
}

/**
 * Pourquoi une grille enregistrée ne se propose plus, ou `null` · ses sections
 * et son plan sont relus tels qu'ils sont aujourd'hui.
 */
export function motifGrilleInapplicable(params: {
  readonly plan: PlanDeGrille;
  readonly compte: CompteDeGrille & { readonly estActif: boolean };
  readonly sections: readonly (SectionDeGrille & { readonly pourcentage: number })[];
}): string | null {
  if (!params.plan.estActif) return `Le plan ${params.plan.code} est en sommeil.`;
  // Le compte et le plan relus tels qu'ils sont aujourd'hui (relecture du
  // 2026-10-30) · un compte endormi, devenu regroupement, ou une classe que
  // le plan ne ventile plus suspendent la grille comme une section.
  if (!params.compte.estActif) return `Le compte ${params.compte.numero} est en sommeil.`;
  if (params.compte.estTotal) return `Le compte ${params.compte.numero} est devenu un compte de regroupement.`;
  const refusClasse = motifRefusClasseVentilee(params.compte.classe, params.plan.classesVentilees);
  if (refusClasse) return `Plan ${params.plan.code} · ${refusClasse}`;
  for (const s of params.sections) {
    if (s.planId !== params.plan.id) return `La section ${s.code} n'est plus du plan ${params.plan.code}.`;
    if (s.estTotal) return `La section ${s.code} est devenue une rubrique · elle ne reçoit plus de ventilation.`;
    if (!s.estActive) return `La section ${s.code} est en sommeil · revoyez la grille.`;
  }
  return null;
}

/**
 * Répartir un montant positif selon la grille, au centime, par le plus fort
 * reste · `null` pour un montant nul ou négatif (une ligne négative se ventile
 * à la main, la saisie n'en propose pas). Les lignes sont rendues dans
 * l'ordre de la grille ; la somme égale le montant au centime.
 */
export function repartirSelonLaGrille(
  montant: number,
  lignes: readonly { readonly sectionId: string; readonly code: string; readonly pourcentage: number }[],
): { sectionId: string; montant: number }[] | null {
  if (!Number.isFinite(montant)) return null;
  const centimes = Math.round(montant * 100);
  if (centimes <= 0 || lignes.length === 0) return null;
  const parts = lignes.map((l) => {
    const points = enPointsDeBase(l.pourcentage) ?? 0;
    const exacte = BigInt(centimes) * BigInt(points);
    const base = exacte / 10_000n;
    return { sectionId: l.sectionId, code: l.code, centimes: Number(base), reste: exacte - base * 10_000n };
  });
  const totalPoints = lignes.reduce((t, l) => t + (enPointsDeBase(l.pourcentage) ?? 0), 0);
  if (totalPoints !== 10_000) return null;
  let manque = centimes - parts.reduce((t, p) => t + p.centimes, 0);
  const ordre = [...parts].sort((a, b) =>
    a.reste === b.reste ? a.code.localeCompare(b.code) : a.reste > b.reste ? -1 : 1,
  );
  for (let i = 0; manque > 0; i++, manque--) ordre[i % ordre.length].centimes += 1;
  return parts.map((p) => ({ sectionId: p.sectionId, montant: p.centimes / 100 }));
}
