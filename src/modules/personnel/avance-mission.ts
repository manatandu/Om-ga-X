/**
 * L'AVANCE DE MISSION, SA RÉGULARISATION, ET LA RÉPARTITION DES FRAIS PAR
 * PROJET (ligne paie-declarations, point 3, gel levé par Manasse le
 * 2026-11-01). Règles pures, sans Prisma.
 *
 * L'AVANCE · une somme remise au travailleur AVANT le départ, pour couvrir
 * les dépenses de la mission. Fiche du compte 42 des deux plans (AUDCIF
 * Titre VII ; SYCEBNL Partie 2 ch. 3) · « débité du montant des avances et
 * acomptes faits au personnel […] par le crédit des comptes de trésorerie » ·
 * D 4211 « Personnel, avances » / C trésorerie (`passation-paie.ts`, rôle
 * AVANCES_AU_PERSONNEL). Pièce exigée (reçu signé, bon de sortie de caisse ·
 * AUDCIF art. 17, 3°).
 *
 * LA RÉGULARISATION AU RETOUR · les frais JUSTIFIÉS de la mission (sur pièce,
 * `missions-salarie.ts` · remboursement d'une dépense effective, hors des deux
 * assiettes) se portent en charge au 6384 « Missions » (fiche du compte 66 ·
 * « en principe être enregistrés en 62 ou 63 ») contre l'avance au 4211.
 * L'écart se règle selon son sens :
 *  · frais = avance · SOLDÉE, D 6384 / C 4211 ;
 *  · frais > avance · COMPLÉMENT PAYÉ au salarié, D 6384 / C 4211 de l'avance /
 *    C trésorerie du complément ;
 *  · frais < avance · le TROP-VERSÉ est RENDU (D 6384 / D trésorerie / C 4211),
 *    ou RETENU SUR LA PAIE · « les retenues ci-après sont autorisées : […]
 *    c) retenues à titre d'avances » (Code du travail, art. 112). Le 4211 garde
 *    alors le trop-versé (D 6384 / C 4211 des seuls frais) et le registre en
 *    tient une AVANCE de ce montant, retenue bulletin après bulletin par la
 *    mécanique existante (`avances-salaire.ts` · jamais au-delà du solde,
 *    aucun plafond que l'art. 112 ne pose, le jugement au cabinet).
 *
 * CE QUI PART AU BULLETIN, ET CE QUI N'Y PART PLUS · une mission AVANCÉE ne
 * porte plus ses frais justifiés au bulletin (la régularisation les impute) ·
 * sans quoi ils seraient remboursés deux fois, au bulletin et par l'avance.
 * L'indemnité FORFAITAIRE, imposable (loi n° 23/053, art. 68, 1°), reste au
 * bulletin · c'est lui qui la soumet à l'impôt. La dépense réglée par
 * l'entité ne se régularise pas (elle se passe par sa facture).
 *
 * LA TVA · aucune ligne de taxe (O.-L. n° 10/001, art. 41, 1°, et
 * `missions-salarie.ts`) · la pièce porte la dépense en charge.
 *
 * CONVENTIONS D'OMEGAX, dites comme telles · une seule avance non annulée par
 * mission ; une avance se verse au plus tard le jour du retour prévu ; la
 * régularisation suit la fin de mission constatée.
 *
 * LA RÉPARTITION PAR PROJET · aucun texte ne la régit (comptabilité analytique
 * de libre usage, classes 92 à 99). Les règles de la répartition de la paie
 * sont reprises (`ventilation-analytique-paie.ts`) · pourcentages qui font
 * 100, sections Détail actives d'un plan qui ventile la classe 6, et la part
 * de chaque section au centime par le PLUS FORT RESTE · jamais un prorata
 * inventé · une mission sans répartition laisse le 6384 non ventilé.
 */
import { enPointsDeBase, PLAFOND_LIGNES_REPARTITION, type PlanConnu, type SectionConnue } from './ventilation-analytique-paie';
import { motifRefusClasseVentilee } from '../analytique/od-analytique';

export type IssueRegularisation = 'SOLDEE' | 'COMPLEMENT_PAYE' | 'TROP_VERSE_RENDU' | 'TROP_VERSE_RETENU';

export const LIBELLE_ISSUE: Readonly<Record<IssueRegularisation, string>> = {
  SOLDEE: 'Avance soldée par les frais',
  COMPLEMENT_PAYE: 'Complément payé au salarié',
  TROP_VERSE_RENDU: 'Trop-versé rendu par le salarié',
  TROP_VERSE_RETENU: 'Trop-versé retenu sur la paie',
};

const c = (n: number) => Math.round(n * 100);
const jour = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));
export const estAuCentimeExact = (n: number) => Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

export type MissionAvancee = {
  readonly numero: number;
  readonly dateDepart: Date | string;
  readonly dateRetour: Date | string;
  readonly annuleLe: Date | null;
  /** Le bulletin ÉMIS qui porte la mission, s'il en est un. */
  readonly porteeParBulletin: number | null;
};

export function motifRefusAvanceMission(params: {
  readonly mission: MissionAvancee;
  readonly montantFc: number;
  readonly date: string;
  readonly pieceJustificative?: string | null;
  readonly avanceExistante: boolean;
}): string | null {
  const { mission, montantFc, date } = params;
  if (mission.annuleLe) return `La mission n° ${mission.numero} est annulée · elle ne reçoit pas d'avance.`;
  if (params.avanceExistante) {
    return `La mission n° ${mission.numero} a déjà une avance non annulée · une seule avance par mission (convention d'OmegaX). Annulez-la pour en verser une autre.`;
  }
  if (mission.porteeParBulletin !== null) {
    return (
      `La mission n° ${mission.numero} est portée par le bulletin émis n° ${mission.porteeParBulletin} · ses frais y sont déjà remboursés. ` +
      'Une avance les ferait payer deux fois · annulez le bulletin d’abord si l’avance est voulue.'
    );
  }
  if (!(montantFc > 0) || !estAuCentimeExact(montantFc)) return "Le montant de l'avance est positif, au centime.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "La date de l'avance se lit AAAA-MM-JJ.";
  if (date > jour(mission.dateRetour)) {
    return `L'avance se verse au plus tard au retour prévu (${jour(mission.dateRetour)}) · après, les frais se remboursent sur pièces (convention d'OmegaX).`;
  }
  if (!params.pieceJustificative?.trim()) {
    return "La pièce de l'avance (reçu signé, bon de sortie de caisse, ordre de virement) est obligatoire (AUDCIF art. 17, 3°).";
  }
  return null;
}

/** L'issue que les montants imposent, ou celle que le cabinet choisit pour un trop-versé. */
export function issueDeLaRegularisation(
  justifieFc: number,
  avanceFc: number,
  tropVerse: 'RENDU' | 'RETENU' | null | undefined,
): { issue: IssueRegularisation; ecartFc: number } | { refus: string } {
  const j = c(justifieFc);
  const a = c(avanceFc);
  if (j === a) return { issue: 'SOLDEE', ecartFc: 0 };
  if (j > a) return { issue: 'COMPLEMENT_PAYE', ecartFc: (j - a) / 100 };
  if (tropVerse === 'RENDU') return { issue: 'TROP_VERSE_RENDU', ecartFc: (a - j) / 100 };
  if (tropVerse === 'RETENU') return { issue: 'TROP_VERSE_RETENU', ecartFc: (a - j) / 100 };
  return {
    refus:
      `Les frais justifiés (${(j / 100).toFixed(2)} FC) n'épuisent pas l'avance (${(a / 100).toFixed(2)} FC) · dites si le trop-versé de ` +
      `${((a - j) / 100).toFixed(2)} FC est rendu par le salarié, ou retenu sur sa paie (Code du travail, art. 112, c).`,
  };
}

/** Une issue qui fait passer de l'argent · le journal doit être de trésorerie. */
export const issueTouchantLaTresorerie = (issue: IssueRegularisation) => issue === 'COMPLEMENT_PAYE' || issue === 'TROP_VERSE_RENDU';

export function motifRefusRegularisation(params: {
  readonly mission: { numero: number; accomplieLe: Date | string | null; annuleLe: Date | null };
  readonly date: string;
  readonly pieceJustificative?: string | null;
  readonly regularisationExistante: boolean;
  readonly dateAvance: Date | string;
}): string | null {
  const { mission, date } = params;
  if (mission.annuleLe) return `La mission n° ${mission.numero} est annulée.`;
  if (params.regularisationExistante) return `L'avance de la mission n° ${mission.numero} est déjà régularisée · annulez la régularisation pour la refaire.`;
  if (!mission.accomplieLe) {
    return `La fin de la mission n° ${mission.numero} n'est pas constatée · la régularisation se fait au retour (constatez la fin de mission d'abord).`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'La date de la régularisation se lit AAAA-MM-JJ.';
  if (date < jour(params.dateAvance)) return `La régularisation ne peut précéder l'avance (${jour(params.dateAvance)}).`;
  if (!params.pieceJustificative?.trim()) {
    return "La pièce de la régularisation (décompte des frais signé par le salarié) est obligatoire (AUDCIF art. 17, 3°).";
  }
  return null;
}

/** Une ligne de l'écriture proposée · par rôle, jamais par numéro (les numéros vivent dans `passation-paie.ts`). */
export type LigneRegularisation = {
  readonly role: 'MISSIONS' | 'AVANCES_AU_PERSONNEL' | 'TRESORERIE';
  readonly debit: number;
  readonly credit: number;
};

/**
 * LES LIGNES DE LA RÉGULARISATION · en centimes entiers, équilibrées par
 * construction. Vide quand rien ne se passe au journal (trop-versé entier
 * retenu, aucun frais justifié).
 */
export function lignesDeLaRegularisation(justifieFc: number, avanceFc: number, issue: IssueRegularisation): LigneRegularisation[] {
  const j = c(justifieFc);
  const a = c(avanceFc);
  const l: LigneRegularisation[] = [];
  if (j > 0) l.push({ role: 'MISSIONS', debit: j / 100, credit: 0 });
  switch (issue) {
    case 'SOLDEE':
      if (a > 0) l.push({ role: 'AVANCES_AU_PERSONNEL', debit: 0, credit: a / 100 });
      break;
    case 'COMPLEMENT_PAYE':
      if (a > 0) l.push({ role: 'AVANCES_AU_PERSONNEL', debit: 0, credit: a / 100 });
      l.push({ role: 'TRESORERIE', debit: 0, credit: (j - a) / 100 });
      break;
    case 'TROP_VERSE_RENDU':
      l.push({ role: 'TRESORERIE', debit: (a - j) / 100, credit: 0 });
      l.push({ role: 'AVANCES_AU_PERSONNEL', debit: 0, credit: a / 100 });
      break;
    case 'TROP_VERSE_RETENU':
      // Le 4211 garde le trop-versé, que les retenues de bulletin soldent.
      if (j > 0) l.push({ role: 'AVANCES_AU_PERSONNEL', debit: 0, credit: j / 100 });
      break;
  }
  return l;
}

// ── LA RÉPARTITION PAR PROJET ────────────────────────────────────────────

export type LigneRepartitionMission = { readonly sectionId: string; readonly pourcentage: number };

/** Même règle que la répartition de la paie · une répartition vide RETIRE celle du plan. */
export function motifRefusRepartitionMission(params: {
  readonly plan: PlanConnu | null;
  readonly sections: readonly SectionConnue[];
  readonly lignes: readonly LigneRepartitionMission[];
}): string | null {
  const { plan, sections, lignes } = params;
  if (!plan) return 'Plan analytique introuvable dans ce dossier.';
  if (!plan.estActif) return `Le plan ${plan.code} est en sommeil · il ne reçoit plus de ventilation.`;
  const refusClasse = motifRefusClasseVentilee('6', plan.classesVentilees);
  if (refusClasse) return `Plan ${plan.code} · ${refusClasse} Les frais de mission sont une charge (6384).`;
  if (lignes.length > PLAFOND_LIGNES_REPARTITION) return `Une répartition porte au plus ${PLAFOND_LIGNES_REPARTITION} sections.`;
  if (lignes.length === 0) return null;
  const vues = new Set<string>();
  let points = 0;
  for (const [i, l] of lignes.entries()) {
    const s = sections.find((x) => x.id === l.sectionId);
    if (!s || s.planId !== plan.id) return `Ligne ${i + 1} · la section n'appartient pas au plan ${plan.code}.`;
    if (s.estTotal) return `Ligne ${i + 1} · ${s.code} est une rubrique (section Total) · elle totalise ses sections, elle ne reçoit rien.`;
    if (!s.estActive) return `Ligne ${i + 1} · la section ${s.code} est en sommeil.`;
    if (vues.has(s.id)) return `Ligne ${i + 1} · la section ${s.code} est déjà répartie plus haut.`;
    vues.add(s.id);
    const p = enPointsDeBase(l.pourcentage);
    if (p === null) return `Ligne ${i + 1} · pourcentage illisible (deux décimales au plus).`;
    if (p <= 0 || p > 10_000) return `Ligne ${i + 1} · un pourcentage est strictement positif et au plus 100.`;
    points += p;
  }
  if (points !== 10_000) {
    return `Les pourcentages font ${(points / 100).toFixed(2)} % · une répartition fait exactement 100 %, sans quoi une part des frais ne serait portée par aucune section.`;
  }
  return null;
}

/**
 * La part de chaque section, au centime, par le plus fort reste (BigInt · un
 * montant en centimes multiplié par 10 000 dépasse l'entier sûr), à égalité
 * par le code de la section. La somme égale le montant au centime, ce que la
 * saisie exige d'une ligne ventilée en totalité sur un plan.
 */
export function partsParSection(
  montantFc: number,
  lignes: readonly { sectionId: string; code: string; pourcentage: number }[],
): { sectionId: string; montantFc: number }[] {
  const total = BigInt(c(montantFc));
  const brutes = lignes.map((l) => {
    const exacte = total * BigInt(enPointsDeBase(l.pourcentage) ?? 0);
    return { sectionId: l.sectionId, code: l.code, base: exacte / 10_000n, reste: exacte % 10_000n };
  });
  let distribue = brutes.reduce((t, b) => t + b.base, 0n);
  const ordre = [...brutes].sort((a, b) => (a.reste === b.reste ? a.code.localeCompare(b.code) : a.reste > b.reste ? -1 : 1));
  const plus = new Map<string, bigint>();
  for (let i = 0; distribue < total && ordre.length > 0; i++, distribue++) {
    const s = ordre[i % ordre.length].sectionId;
    plus.set(s, (plus.get(s) ?? 0n) + 1n);
  }
  return brutes.map((b) => ({ sectionId: b.sectionId, montantFc: Number(b.base + (plus.get(b.sectionId) ?? 0n)) / 100 }));
}
