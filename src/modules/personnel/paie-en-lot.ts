/**
 * LIGNE PAIE-LOT (2026-11-01, gel levé par Manasse, « Fais tout le point 1 »).
 *
 * DEUX RÈGLES PURES, sans lecture ni écriture.
 *
 * 1. LES PARAMÈTRES DE PAIE DU DOSSIER · nature de l'employeur et effectif de
 *    la tranche INPP (DATÉS · le taux dépend du mois, décision T5), régime de
 *    la retenue de l'art. 121 quand il qualifie l'EMPLOYEUR. Chacun se
 *    DÉCLARE · `null` est « pas encore dit », jamais un défaut, et le manque
 *    est NOMMÉ dans la proposition, comme la simulation le dit quand le champ
 *    lui manque. Ils ne font que PRÉREMPLIR la saisie · le calcul du serveur
 *    reste celui de `simulerPaie`, qui ne lit que le corps reçu, et le
 *    bulletin fige ce corps.
 *
 * 2. LE CORPS PROPOSÉ D'UN BULLETIN · le salaire du contrat en premier
 *    élément, dans SA monnaie (Code du travail, art. 89 ; décision de Manasse
 *    du 2026-09-24 sur le salaire en dollars), les jours payés du SALARIÉ ce
 *    mois, les paramètres du dossier, la classe du contrat (P1b), et les
 *    allocations de congé du mois. Le salaire repris est celui des JOURS DUS
 *    que le moteur des absences propose (`absences.ts`, `propositionDuMois`)
 *    · l'allocation de congé remplace le salaire des jours de congé
 *    (art. 142). Rien n'est deviné · une rémunération qui n'est pas mensuelle,
 *    une monnaie non renseignée ou une proposition non chiffrée laissent le
 *    salaire à saisir, et c'est DIT. Les personnes à charge (art. 124 et 125)
 *    ne sont jamais reprises du registre · proposées, jamais substituées.
 */

export const NATURES_EMPLOYEUR_INPP = ['PUBLIC', 'PRIVE'] as const;
export type NatureEmployeurInppDeclaree = (typeof NATURES_EMPLOYEUR_INPP)[number];

/**
 * LES RÉGIMES DE L'ART. 121 QUI SE DÉCLARENT AU DOSSIER · ceux qui qualifient
 * l'EMPLOYEUR. L'alinéa 2 (loi n° 23/053, lu dans la compilation DGI) vise
 * « le personnel domestique » · une qualité du TRAVAILLEUR, qui se déclare à
 * la simulation du salarié, jamais au dossier ; et « les salariés relevant de
 * l'Impôt sur le Revenu des Personnes Physiques de l'Administration des
 * Micro-entreprises » · l'employeur est une micro-entreprise. La condition
 * « pour autant que ces rémunérations constituent pour eux des revenus
 * uniques » porte sur chaque travailleur · elle n'est pas jugée ici, la
 * réserve du calcul (`REGIMES_SALARIAUX`) la dit.
 */
export const REGIMES_SALARIAUX_DU_DOSSIER = ['BAREME_ARTICLE_118', 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE'] as const;
export type RegimeSalarialDuDossier = (typeof REGIMES_SALARIAUX_DU_DOSSIER)[number];

/** Les bornes du DTO et de la base (CHECK de la migration) · une seule écriture. */
export const BORNES_PARAMETRES_PAIE = {
  effectifMax: 1_000_000,
} as const;

export const MOIS_AAAA_MM = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface ParametresPaieDossier {
  natureEmployeurInpp: NatureEmployeurInppDeclaree | null;
  effectifInpp: number | null;
  /** Premier mois (AAAA-MM) à partir duquel nature et effectif valent · null sans déclaration. */
  inppDepuisMois: string | null;
  regimeSalarial: RegimeSalarialDuDossier | null;
}

/** Les paramètres tels que la base les rend · une valeur hors liste est lue comme « pas encore dit ». */
export function lireParametresPaie(t: {
  paieNatureEmployeurInpp: string | null;
  paieEffectifInpp: number | null;
  paieInppDepuisMois: string | null;
  paieRegimeSalarial: string | null;
}): ParametresPaieDossier {
  const depuis = t.paieInppDepuisMois !== null && MOIS_AAAA_MM.test(t.paieInppDepuisMois) ? t.paieInppDepuisMois : null;
  return {
    // Sans mois d'effet lisible, ni nature ni effectif ne se reprennent.
    natureEmployeurInpp:
      depuis !== null && (NATURES_EMPLOYEUR_INPP as readonly string[]).includes(t.paieNatureEmployeurInpp ?? '')
        ? (t.paieNatureEmployeurInpp as NatureEmployeurInppDeclaree)
        : null,
    effectifInpp: depuis !== null ? t.paieEffectifInpp : null,
    inppDepuisMois: depuis,
    regimeSalarial: (REGIMES_SALARIAUX_DU_DOSSIER as readonly string[]).includes(t.paieRegimeSalarial ?? '')
      ? (t.paieRegimeSalarial as RegimeSalarialDuDossier)
      : null,
  };
}

/** Nature et effectif INPP repris pour CE mois · jamais pour un mois antérieur à leur déclaration. */
export function inppDuMois(
  p: ParametresPaieDossier,
  mois: string,
): { natureEmployeurInpp: NatureEmployeurInppDeclaree | null; effectifInpp: number | null; anterieur: boolean } {
  if (p.inppDepuisMois === null) return { natureEmployeurInpp: null, effectifInpp: null, anterieur: false };
  if (mois < p.inppDepuisMois) return { natureEmployeurInpp: null, effectifInpp: null, anterieur: true };
  return { natureEmployeurInpp: p.natureEmployeurInpp, effectifInpp: p.effectifInpp, anterieur: false };
}

const libelleMois = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

/** Ce que les paramètres non déclarés laissent à la simulation de CE mois · nommé, jamais tu. */
export function manquesDesParametres(p: ParametresPaieDossier, mois: string): string[] {
  const manques: string[] = [];
  const inpp = inppDuMois(p, mois);
  if (inpp.anterieur) {
    manques.push(
      `Nature de l'employeur et effectif INPP déclarés au dossier à partir de ${libelleMois(p.inppDepuisMois as string)} · rien n'est repris pour ${libelleMois(mois)}, la cotisation INPP s'abstient.`,
    );
  } else if (inpp.natureEmployeurInpp === null) {
    manques.push("Nature de l'employeur pour l'INPP non déclarée · la cotisation INPP s'abstient et le bulletin ne s'émet pas.");
  } else if (inpp.natureEmployeurInpp === 'PRIVE' && inpp.effectifInpp === null) {
    manques.push('Effectif de la tranche INPP non déclaré · le taux du secteur privé dépend du nombre de travailleurs occupés.');
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
  /** Jours payés à 100 % sur la base du mois (mention 6) · `null` quand rien ne se propose. */
  joursPayesAPlein: number | null;
  /** Jours du mois payés par l'allocation de congé (mention 14). */
  joursDeConge: number;
  /** Jours payables du mois · vingt-six, ou ceux du mois entier d'absence. */
  baseDuMois: number;
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
  regimeSalarial?: RegimeSalarialDuDossier;
  joursPayes?: number;
  classeProfessionnelle?: number;
}

/** Ce que la ligne a repris du dossier, avec sa source · affiché sur la ligne du lot. */
export interface RepriseDuDossier {
  natureEmployeurInpp: NatureEmployeurInppDeclaree | null;
  effectifInpp: number | null;
  inppDepuisMois: string | null;
  regimeSalarial: RegimeSalarialDuDossier | null;
  source: 'Déclaré au dossier';
}

const LIBELLES_PERIODICITE: Record<string, string> = { JOUR: 'au jour', SEMAINE: 'à la semaine', ANNEE: "à l'année" };

/**
 * LES JOURS PAYÉS DU MOIS, POUR LE PLANCHER DE LA CNSS (décret n° 18/041,
 * art. 8 · « en aucun cas » sous le SMIG des jours payés). Un fait du
 * SALARIÉ et du MOIS, lu sur la proposition des absences · jamais un nombre
 * du dossier (relecture du 2026-11-01, B1).
 *  · mois sans jour retenu · rien n'est envoyé, le calcul prend le mois
 *    entier (vingt-six, décret n° 25/22, art. 7) ;
 *  · jours payés à plein et jours de congé (payés par l'allocation, art. 142 ;
 *    mentions 6 et 14 du livre de paie, arrêté du 8 août 2008) · leur somme ;
 *  · jours payés aux DEUX TIERS (mention 17) · rien n'est envoyé et c'est
 *    dit · le corpus ne dit pas si un jour payé aux deux tiers compte au
 *    SMIG des jours payés pour un plein jour, une fraction ou pas du tout.
 */
export function joursPayesDuMois(a: PropositionAbsences | null): { jours: number | null; manque: string | null } {
  if (a === null || a.joursPayesAPlein === null) return { jours: null, manque: null };
  if (a.joursDeuxTiers > 0) {
    return {
      jours: null,
      manque: `${a.joursDeuxTiers} jour(s) payé(s) aux deux tiers ce mois · les jours payés du plancher de la CNSS se déclarent dans la Simulation.`,
    };
  }
  const jours = a.joursPayesAPlein + a.joursDeConge;
  if (jours >= a.baseDuMois) return { jours: null, manque: null };
  if (!Number.isInteger(jours) || jours < 1 || jours > 26) {
    return { jours: null, manque: `${jours} jour(s) payé(s) ce mois · non repris au plancher de la CNSS, à déclarer dans la Simulation.` };
  }
  return { jours, manque: null };
}

/**
 * LE CORPS PROPOSÉ · voir l'en-tête. `manques` nomme ce qui n'a pas été
 * repris ; `bloquants` ce qui rend le bulletin NON ÉMISSIBLE en lot (une
 * allocation de congé du mois qui ne se porte pas laisserait le salarié
 * sous-payé de ses jours de congé, déjà retranchés du salaire) ;
 * `salaireRepris` dit si le premier élément est le salaire du contrat. Le
 * corps est exactement celui que l'émission unitaire reçoit.
 */
export function corpsPropose(p: {
  moisDePaie: string;
  parametres: ParametresPaieDossier;
  contrat: ContratPourProposition;
  absences: PropositionAbsences | null;
  conges: readonly CongePortable[];
}): { corps: CorpsPropose; manques: string[]; bloquants: string[]; salaireRepris: boolean; reprise: RepriseDuDossier } {
  const manques: string[] = [];
  const bloquants: string[] = [];
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
    manques.push('Le contrat ne porte pas de rémunération de base · le salaire du mois se saisit au bulletin.');
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
    // LES JOURS PAYÉS DU SALARIÉ CE MOIS (plancher de la CNSS).
    const j = joursPayesDuMois(p.absences);
    if (j.jours !== null) corps.joursPayes = j.jours;
    if (j.manque) manques.push(j.manque);
  }

  // LES ALLOCATIONS DE CONGÉ DU MOIS · une allocation qui ne se porte pas
  // BLOQUE la ligne · ses jours sont déjà retranchés du salaire (art. 142).
  const deviseBulletin = devise ?? 'CDF';
  const portables: { congeId: string }[] = [];
  for (const c of p.conges) {
    if (c.portePar !== null) continue;
    if (c.montant === null) {
      bloquants.push("Une allocation de congé du mois n'est pas chiffrée · ce bulletin se fait dans la Simulation, les jours de congé sont déjà retranchés du salaire.");
    } else if ((c.devise ?? null) !== deviseBulletin) {
      bloquants.push(`Une allocation de congé du mois est en ${c.devise ?? 'monnaie non renseignée'}, le bulletin en ${deviseBulletin} · ce bulletin se fait dans la Simulation.`);
    } else portables.push({ congeId: c.id });
  }
  if (portables.length) corps.allocationsConge = portables;

  // LES PARAMÈTRES DU DOSSIER, seulement s'ils sont déclarés, et l'INPP
  // seulement pour un mois couvert par sa déclaration.
  const par = p.parametres;
  const inpp = inppDuMois(par, p.moisDePaie);
  if (inpp.natureEmployeurInpp !== null) corps.natureEmployeurInpp = inpp.natureEmployeurInpp;
  if (inpp.effectifInpp !== null) corps.effectif = inpp.effectifInpp;
  if (par.regimeSalarial !== null) corps.regimeSalarial = par.regimeSalarial;
  manques.push(...manquesDesParametres(par, p.moisDePaie));

  // ARTICLE 114 · la classe du contrat (décret n° 25/22), sinon la quotité ne se chiffre pas.
  if (p.contrat.classeProfessionnelle !== null) corps.classeProfessionnelle = p.contrat.classeProfessionnelle;
  else manques.push('Classe professionnelle du contrat non renseignée · la quotité saisissable ne se chiffre pas.');

  return {
    corps,
    manques,
    bloquants,
    salaireRepris,
    reprise: {
      natureEmployeurInpp: inpp.natureEmployeurInpp,
      effectifInpp: inpp.effectifInpp,
      inppDepuisMois: par.inppDepuisMois,
      regimeSalarial: par.regimeSalarial,
      source: 'Déclaré au dossier',
    },
  };
}

/**
 * UN BULLETIN DU LOT EST ÉMISSIBLE seulement si la simulation n'a aucun motif
 * de refus, si la proposition n'a rien de bloquant, ET s'il porte au moins un
 * élément · un bulletin vide passerait la simulation à zéro partout, et un
 * geste en lot ne doit jamais émettre ce que personne n'a saisi.
 */
export function motifsNonEmissible(corps: CorpsPropose, motifsSimulation: readonly string[], bloquants: readonly string[] = []): string[] {
  const motifs = [...bloquants, ...motifsSimulation];
  if (corps.elements.length === 0 && !corps.allocationsConge?.length) {
    motifs.unshift('Aucun élément de rémunération · le bulletin se saisit depuis la Simulation.');
  }
  return motifs;
}
