import type { RegimeSalarial } from './bareme-irpp';

/**
 * LIGNE PAIE-LOT (2026-11-01, gel levé par Manasse, « Fais tout le point 1 »).
 *
 * DEUX RÈGLES PURES, sans lecture ni écriture.
 *
 * 1. LES PARAMÈTRES DE PAIE DU DOSSIER · nature de l'employeur pour l'INPP,
 *    régime de la retenue de l'art. 121, effectif de la tranche INPP, jours
 *    payés proposés. Chacun se DÉCLARE · `null` est « pas encore dit », jamais
 *    un défaut, et le manque est NOMMÉ dans la proposition, comme la
 *    simulation le dit quand le champ lui manque. Ils ne font que PRÉREMPLIR
 *    la saisie · le calcul du serveur reste celui de `simulerPaie`, qui ne lit
 *    que le corps reçu, et le bulletin fige ce corps.
 *
 * 2. LE CORPS PROPOSÉ D'UN BULLETIN · le salaire du contrat en premier
 *    élément, dans SA monnaie (Code du travail, art. 89 ; décision de Manasse
 *    du 2026-09-24 sur le salaire en dollars), les paramètres du dossier, la
 *    classe du contrat (P1b), et les allocations de congé du mois qui se
 *    portent. Le salaire repris est celui des JOURS DUS que le moteur des
 *    absences propose (`absences.ts`, `propositionDuMois`) · l'allocation de
 *    congé remplace le salaire des jours de congé (art. 142), et l'émission
 *    refuserait un salaire plein avec des jours de congé dans le mois. Rien
 *    n'est deviné · une rémunération qui n'est pas mensuelle, une monnaie non
 *    renseignée ou une proposition non chiffrée laissent le salaire à saisir,
 *    et c'est DIT. Les personnes à charge (art. 124 et 125) ne sont jamais
 *    reprises du registre · proposées, jamais substituées.
 */

export const NATURES_EMPLOYEUR_INPP = ['PUBLIC', 'PRIVE'] as const;
export type NatureEmployeurInppDeclaree = (typeof NATURES_EMPLOYEUR_INPP)[number];

export const REGIMES_SALARIAUX_DECLARES: readonly RegimeSalarial[] = [
  'BAREME_ARTICLE_118',
  'FORFAIT_PERSONNEL_DOMESTIQUE',
  'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE',
];

/** Les bornes du DTO et de la base (CHECK de la migration) · une seule écriture. */
export const BORNES_PARAMETRES_PAIE = {
  effectifMax: 1_000_000,
  // Décret n° 25/22, art. 7 · vingt-six jours par mois.
  joursMin: 1,
  joursMax: 26,
} as const;

export interface ParametresPaieDossier {
  natureEmployeurInpp: NatureEmployeurInppDeclaree | null;
  regimeSalarial: RegimeSalarial | null;
  effectifInpp: number | null;
  joursPayes: number | null;
}

/** Les paramètres tels que la base les rend · une valeur hors liste est lue comme « pas encore dit ». */
export function lireParametresPaie(t: {
  paieNatureEmployeurInpp: string | null;
  paieRegimeSalarial: string | null;
  paieEffectifInpp: number | null;
  paieJoursPayes: number | null;
}): ParametresPaieDossier {
  return {
    natureEmployeurInpp: (NATURES_EMPLOYEUR_INPP as readonly string[]).includes(t.paieNatureEmployeurInpp ?? '')
      ? (t.paieNatureEmployeurInpp as NatureEmployeurInppDeclaree)
      : null,
    regimeSalarial: (REGIMES_SALARIAUX_DECLARES as readonly string[]).includes(t.paieRegimeSalarial ?? '')
      ? (t.paieRegimeSalarial as RegimeSalarial)
      : null,
    effectifInpp: t.paieEffectifInpp,
    joursPayes: t.paieJoursPayes,
  };
}

/** Ce que les paramètres non déclarés laissent à la simulation · nommé, jamais tu. */
export function manquesDesParametres(p: ParametresPaieDossier): string[] {
  const manques: string[] = [];
  if (p.natureEmployeurInpp === null) {
    manques.push("Nature de l'employeur pour l'INPP non déclarée · la cotisation INPP s'abstient et le bulletin ne s'émet pas.");
  } else if (p.natureEmployeurInpp === 'PRIVE' && p.effectifInpp === null) {
    manques.push("Effectif de la tranche INPP non déclaré · le taux du secteur privé dépend du nombre de travailleurs occupés.");
  }
  if (p.regimeSalarial === null) {
    manques.push("Régime de la retenue (art. 121) non déclaré · le barème de l'article 118 est retenu et le calcul le dit.");
  }
  return manques;
}

export interface ContratPourProposition {
  classeProfessionnelle: number | null;
  deviseRemuneration: string | null;
  periodiciteRemuneration: string | null;
  remunerationBase: number | null;
}

export interface PropositionAbsences {
  salaireDesJoursDus: number | null;
  joursDeuxTiers: number;
  indemniteDeuxTiers: number | null;
  motifs: readonly string[];
}

export interface CongePortable {
  id: string;
  devise: string | null;
  montant: number | null;
  portePar: number | null;
}

export interface ElementPropose {
  nature: string;
  libelle: string;
  montantFc?: number;
  montantUsd?: number;
}

export interface CorpsPropose {
  moisDePaie: string;
  deviseStipulation?: 'USD';
  elements: ElementPropose[];
  allocationsConge?: { congeId: string }[];
  natureEmployeurInpp?: NatureEmployeurInppDeclaree;
  effectif?: number;
  regimeSalarial?: RegimeSalarial;
  joursPayes?: number;
  classeProfessionnelle?: number;
}

const LIBELLES_PERIODICITE: Record<string, string> = { JOUR: 'au jour', SEMAINE: 'à la semaine', ANNEE: "à l'année" };

/**
 * LE CORPS PROPOSÉ · voir l'en-tête. `manques` nomme tout ce qui n'a pas été
 * repris ; `salaireRepris` dit si le premier élément est le salaire du
 * contrat. Le corps est exactement celui que l'émission unitaire reçoit.
 */
export function corpsPropose(p: {
  moisDePaie: string;
  parametres: ParametresPaieDossier;
  contrat: ContratPourProposition;
  absences: PropositionAbsences | null;
  conges: readonly CongePortable[];
}): { corps: CorpsPropose; manques: string[]; salaireRepris: boolean } {
  const manques: string[] = [];
  const corps: CorpsPropose = { moisDePaie: p.moisDePaie, elements: [] };
  const devise = p.contrat.deviseRemuneration === 'USD' ? 'USD' : p.contrat.deviseRemuneration === 'CDF' ? 'CDF' : null;
  if (devise === 'USD') corps.deviseStipulation = 'USD';

  // LE SALAIRE DU CONTRAT, PREMIER ÉLÉMENT, DANS SA MONNAIE.
  let salaireRepris = false;
  const montant = (v: number): ElementPropose =>
    devise === 'USD'
      ? { nature: 'SALAIRE_OU_TRAITEMENT', libelle: '', montantUsd: v }
      : { nature: 'SALAIRE_OU_TRAITEMENT', libelle: '', montantFc: v };
  if (p.contrat.remunerationBase === null) {
    manques.push("Le contrat ne porte pas de rémunération de base · le salaire du mois se saisit au bulletin.");
  } else if (devise === null) {
    manques.push("Monnaie de la rémunération du contrat non renseignée · le salaire n'est pas repris (Code du travail, art. 89).");
  } else if (p.contrat.periodiciteRemuneration !== 'MOIS') {
    const per = LIBELLES_PERIODICITE[p.contrat.periodiciteRemuneration ?? ''] ?? 'sans périodicité renseignée';
    manques.push(`Rémunération stipulée ${per} · le salaire du mois se saisit au bulletin, OmegaX ne le reconstitue pas.`);
  } else if (p.absences === null || p.absences.salaireDesJoursDus === null) {
    manques.push(
      `Salaire des jours dus non chiffré${p.absences && p.absences.motifs.length ? ` · ${p.absences.motifs.join(' · ')}` : ''} · le salaire du mois se saisit au bulletin.`,
    );
  } else if (p.absences.joursDeuxTiers > 0 && p.absences.indemniteDeuxTiers === null) {
    manques.push("Indemnité d'incapacité aux deux tiers non chiffrée · le salaire et l'indemnité se saisissent au bulletin.");
  } else {
    const dus = p.absences.salaireDesJoursDus;
    const e = montant(dus);
    e.libelle = dus === p.contrat.remunerationBase ? 'Salaire du contrat' : 'Salaire des jours dus';
    corps.elements.push(e);
    salaireRepris = true;
    if (p.absences.joursDeuxTiers > 0 && p.absences.indemniteDeuxTiers !== null) {
      const i = montant(p.absences.indemniteDeuxTiers);
      i.nature = 'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT';
      i.libelle = `Incapacité · ${p.absences.joursDeuxTiers} jour(s) aux deux tiers`;
      corps.elements.push(i);
    }
  }

  // LES ALLOCATIONS DE CONGÉ DU MOIS · seules celles qui se portent dans la
  // monnaie du bulletin ; les autres sont nommées.
  const deviseBulletin = devise ?? 'CDF';
  const portables: { congeId: string }[] = [];
  for (const c of p.conges) {
    if (c.portePar !== null) continue;
    if (c.montant === null) manques.push('Une allocation de congé du mois n’est pas chiffrée · elle ne se porte pas.');
    else if ((c.devise ?? null) !== deviseBulletin) manques.push(`Une allocation de congé du mois est en ${c.devise ?? 'monnaie non renseignée'}, le bulletin en ${deviseBulletin} · elle ne se porte pas.`);
    else portables.push({ congeId: c.id });
  }
  if (portables.length) corps.allocationsConge = portables;

  // LES PARAMÈTRES DU DOSSIER, seulement s'ils sont déclarés.
  const par = p.parametres;
  if (par.natureEmployeurInpp !== null) corps.natureEmployeurInpp = par.natureEmployeurInpp;
  if (par.effectifInpp !== null) corps.effectif = par.effectifInpp;
  if (par.regimeSalarial !== null) corps.regimeSalarial = par.regimeSalarial;
  if (par.joursPayes !== null) corps.joursPayes = par.joursPayes;
  manques.push(...manquesDesParametres(par));

  // ARTICLE 114 · la classe du contrat (décret n° 25/22), sinon la quotité ne se chiffre pas.
  if (p.contrat.classeProfessionnelle !== null) corps.classeProfessionnelle = p.contrat.classeProfessionnelle;
  else manques.push('Classe professionnelle du contrat non renseignée · la quotité saisissable ne se chiffre pas.');

  return { corps, manques, salaireRepris };
}

/**
 * UN BULLETIN DU LOT EST ÉMISSIBLE seulement si la simulation n'a aucun motif
 * de refus ET s'il porte au moins un élément · un bulletin vide passerait la
 * simulation à zéro partout, et un geste en lot ne doit jamais émettre ce que
 * personne n'a saisi.
 */
export function motifsNonEmissible(corps: CorpsPropose, motifsSimulation: readonly string[]): string[] {
  const motifs = [...motifsSimulation];
  if (corps.elements.length === 0 && !(corps.allocationsConge?.length)) {
    motifs.unshift('Aucun élément de rémunération · le bulletin se saisit depuis la Simulation.');
  }
  return motifs;
}
