/**
 * LIGNE ANALYTIQUE, FONCTION N° 48 · LA GRILLE ANALYTIQUE DU COMPTE, À LA
 * SAISIE.
 *
 * La grille est PROPOSÉE quand le compte est choisi · l'axe montre « Grille »,
 * que le comptable garde, remplace par une section ou efface. Elle n'est
 * jamais imposée, et le serveur ne l'applique pas d'office.
 *
 * LA RÉPARTITION AU CENTIME EST CELLE DU SERVEUR, RECOPIÉE ET TENUE EN MIROIR
 * (`src/modules/analytique/grille-analytique.ts`) · les deux specs rejouent les
 * cas de `src/modules/analytique/cas-grille-analytique.json`. Le plus fort
 * reste, à égalité par le code de la section · la somme fait la ligne au
 * centime, ce que la saisie exige axe par axe.
 *
 * Elle se calcule à L'ENVOI, sur le montant de la ligne tel qu'il est alors ·
 * une ligne recopiée (Ctrl+D) garde la marque « Grille » et sera répartie sur
 * son propre montant, jamais sur celui de la ligne d'origine.
 */

/** La marque d'un axe de la ligne qui suit la grille de son compte. */
export const SECTION_GRILLE = '__grille__';

export type LigneDeGrille = { sectionId: string; code: string; intitule?: string; pourcentage: number };

export interface GrilleAnalytiqueLue {
  id: string;
  compte: { id: string; numero: string; intitule: string };
  plan: { id: string; code: string; intitule: string };
  lignes: LigneDeGrille[];
  /** Pourquoi la grille ne se propose plus aujourd'hui · `null` quand elle s'applique. */
  inapplicable: string | null;
  modifieeLe: string;
}

export interface ListeGrillesAnalytiques {
  grilles: GrilleAnalytiqueLue[];
  total: number;
  tronque: boolean;
}

/** Le pourcentage en points de base (60,25 % → 6 025), `null` au-delà de deux décimales. */
export function enPointsDeBase(pourcentage: number): number | null {
  if (!Number.isFinite(pourcentage)) return null;
  const points = Math.round(pourcentage * 100);
  return Math.abs(points - pourcentage * 100) < 1e-6 ? points : null;
}

/** Répartir un montant positif selon la grille, au centime · `null` pour un montant nul ou négatif. */
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

/** La grille qui se propose pour ce compte sur cet axe · jamais une grille inapplicable. */
export function grilleProposee(
  grilles: readonly GrilleAnalytiqueLue[] | null,
  compteId: string | null | undefined,
  planId: string,
): GrilleAnalytiqueLue | null {
  if (!grilles || !compteId) return null;
  return grilles.find((g) => g.compte.id === compteId && g.plan.id === planId && g.inapplicable === null) ?? null;
}

/** Ce que la grille dit d'une ligne, pour la bulle · « P1 60 % · P2 40 % ». */
export function resumeDeLaGrille(g: GrilleAnalytiqueLue): string {
  return g.lignes.map((l) => `${l.code} ${l.pourcentage.toLocaleString('fr-FR')} %`).join(' · ');
}

/**
 * Les ventilations d'une ligne de la pièce, axe par axe · une section choisie
 * porte toute la ligne, la marque « Grille » la répartit. Une grille qui ne se
 * propose plus (retirée, section en sommeil) ou un montant nul refusent
 * l'envoi en le disant · jamais une ventilation partielle, que le serveur
 * refuserait, ni une ligne partie sans sa ventilation.
 */
export function ventilationsDeLaLigne(
  ligne: { compteId: string; numero: string; debit: number; credit: number; sections?: Record<string, string> },
  grilles: readonly GrilleAnalytiqueLue[] | null,
  codeDuPlan: (planId: string) => string,
): { ventilations: { sectionId: string; debit?: number; credit?: number }[] } | { erreur: string } {
  const ventilations: { sectionId: string; debit?: number; credit?: number }[] = [];
  for (const [planId, valeur] of Object.entries(ligne.sections ?? {})) {
    if (!valeur) continue;
    if (valeur !== SECTION_GRILLE) {
      ventilations.push({ sectionId: valeur, debit: ligne.debit || undefined, credit: ligne.credit || undefined });
      continue;
    }
    const grille = grilleProposee(grilles, ligne.compteId, planId);
    if (!grille) {
      return {
        erreur: `La grille du compte ${ligne.numero} sur l'axe ${codeDuPlan(planId)} ne se propose plus · choisissez une section pour cette ligne.`,
      };
    }
    const auDebit = ligne.debit > 0;
    const parts = repartirSelonLaGrille(auDebit ? ligne.debit : ligne.credit, grille.lignes);
    if (!parts) {
      return {
        erreur: `La ligne ${ligne.numero} n'a pas de montant positif · la grille de l'axe ${codeDuPlan(planId)} ne la répartit pas, choisissez une section.`,
      };
    }
    // Une part nulle (un centime en deux moitiés) ne fait pas de ventilation ·
    // le serveur refuse un montant ni au débit ni au crédit.
    for (const p of parts) {
      if (p.montant === 0) continue;
      ventilations.push(auDebit ? { sectionId: p.sectionId, debit: p.montant } : { sectionId: p.sectionId, credit: p.montant });
    }
  }
  return { ventilations };
}
