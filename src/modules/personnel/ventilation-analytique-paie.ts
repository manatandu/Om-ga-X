/**
 * LIGNE SAGE-L5, FONCTION 88 · LA VENTILATION ANALYTIQUE DE LA PAIE.
 *
 * Chaque salarié porte, par plan analytique, une RÉPARTITION entre sections
 * (pourcentages qui font 100), datée par le mois de paie à partir duquel elle
 * vaut. La passation du mois (`comptabilisation-paie.ts`) l'applique aux
 * lignes de l'écriture de paie · la part de CHAQUE bulletin dans une ligne
 * (rejouée sur ses chiffres figés, comme la passation elle-même) se répartit
 * selon la répartition de son salarié, et les parts s'additionnent par
 * section.
 *
 * AUCUN TEXTE NE RÉGIT CETTE RÉPARTITION · la comptabilité analytique est de
 * libre usage (classes 92 à 99, « libre usage » des deux plans, § 7 du
 * règlement du dépôt). La répartition par salarié, les pourcentages et
 * l'arrondi sont des CONVENTIONS D'OMEGAX, dites dans la bulle. Ce qui ne se
 * discute pas vient des règles de ventilation existantes, reprises telles
 * quelles (`analytique/od-analytique.ts`, `EcritureService.verifierSectionsVentilees`) ·
 * sections Détail seules, actives, du plan ; plan qui ventile la classe du
 * compte ; montant ni négatif ni des deux côtés ; une ligne ventilée EN
 * TOTALITÉ sur un plan, ou pas du tout.
 *
 * UNE RÉPARTITION ABSENTE LAISSE LA LIGNE NON VENTILÉE, ET LE DIT · un
 * salarié sans répartition sur un plan, une section passée en sommeil, une
 * pièce d'origine non ventilée sous la reprise en négatif d'un bulletin
 * annulé · la ligne part sans ventilation sur ce plan, et la proposition
 * nomme la ligne, le plan et la cause, avec l'issue qui lève le refus. Rien
 * n'est réparti au prorata des autres salariés · ce serait porter sur une
 * section une dépense qu'elle n'a pas (audit final F141). LA REPRISE EN
 * NÉGATIF se ventile comme la pièce d'origine (relecture M3, voir
 * `ventilerLaPaie`).
 *
 * AU CENTIME, PAR LE PLUS FORT RESTE · les parts exactes (centimes × points
 * de base) se tronquent, et les centimes qui manquent vont aux sections dont
 * le reste est le plus fort, à égalité par le code de la section. La somme
 * par plan égale la ligne au centime, ce que la saisie exige.
 */
import { moisValide } from './bulletin-paie';
import { entreeDuBulletin, TOTAL_DU_BLOC, type BulletinAComptabiliser, type LigneDuMois, type OrigineDuBulletin } from './comptabilisation-paie';
import { compteDuRole, passationPaie, type BlocPaie, type Referentiel } from './passation-paie';
import { motifRefusClasseVentilee } from '../analytique/od-analytique';

/** Au plus cinquante sections par répartition · borne de saisie, convention d'OmegaX. */
export const PLAFOND_LIGNES_REPARTITION = 50;

/** La classe des charges de personnel · la répartition sert la paie, le plan doit la ventiler. */
export const CLASSE_DES_CHARGES_DE_PERSONNEL = '6';

export type LigneRepartition = { readonly sectionId: string; readonly pourcentage: number };

export type VersionRepartition = {
  readonly id: string;
  readonly salarieId: string;
  readonly planId: string;
  /** AAAA-MM · premier mois de paie où elle vaut. */
  readonly moisEffet: string;
  readonly lignes: readonly LigneRepartition[];
};

export type PlanConnu = {
  readonly id: string;
  readonly code: string;
  readonly classesVentilees: string;
  readonly estActif: boolean;
};

export type SectionConnue = {
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

/**
 * Le refus d'une répartition déclarée, ou `null`. Une répartition VIDE est
 * admise · elle dit qu'à partir de ce mois le salarié ne se répartit plus sur
 * ce plan (il quitte le projet), et ses lignes restent non ventilées.
 */
export function motifRefusRepartition(params: {
  readonly plan: PlanConnu | null;
  readonly sections: readonly SectionConnue[];
  readonly lignes: readonly LigneRepartition[];
  readonly moisEffet: string;
}): string | null {
  const { plan, sections, lignes, moisEffet } = params;
  if (!moisValide(moisEffet)) return "Mois d'effet illisible · la forme attendue est AAAA-MM.";
  if (!plan) return 'Plan analytique introuvable dans ce dossier.';
  if (!plan.estActif) return `Le plan ${plan.code} est en sommeil · il ne reçoit plus de ventilation.`;
  const refusClasse = motifRefusClasseVentilee(CLASSE_DES_CHARGES_DE_PERSONNEL, plan.classesVentilees);
  if (refusClasse) return `Plan ${plan.code} · ${refusClasse} La répartition de la paie ventile les charges de personnel.`;
  if (lignes.length > PLAFOND_LIGNES_REPARTITION) {
    return `Une répartition porte au plus ${PLAFOND_LIGNES_REPARTITION} sections.`;
  }
  if (lignes.length === 0) return null;
  const vues = new Set<string>();
  let points = 0;
  for (const [i, l] of lignes.entries()) {
    const s = sections.find((x) => x.id === l.sectionId);
    if (!s || s.planId !== plan.id) return `Ligne ${i + 1} · la section n'appartient pas au plan ${plan.code}.`;
    if (s.estTotal) {
      return `Ligne ${i + 1} · ${s.code} est une rubrique (section Total) · elle totalise ses sections, elle ne reçoit rien.`;
    }
    if (!s.estActive) return `Ligne ${i + 1} · la section ${s.code} est en sommeil.`;
    if (vues.has(s.id)) return `Ligne ${i + 1} · la section ${s.code} est déjà répartie plus haut.`;
    vues.add(s.id);
    const p = enPointsDeBase(l.pourcentage);
    if (p === null) return `Ligne ${i + 1} · pourcentage illisible (deux décimales au plus).`;
    if (p <= 0 || p > 10_000) return `Ligne ${i + 1} · un pourcentage est strictement positif et au plus 100.`;
    points += p;
  }
  if (points !== 10_000) {
    return `Les pourcentages font ${(points / 100).toFixed(2)} % · une répartition fait exactement 100 %, sans quoi une part de la charge ne serait portée par aucune section.`;
  }
  return null;
}

/** La version en vigueur pour ce mois · la plus récente dont le mois d'effet ne le dépasse pas. */
export function versionDuMois(
  versions: readonly VersionRepartition[],
  salarieId: string,
  planId: string,
  mois: string,
): VersionRepartition | null {
  let retenue: VersionRepartition | null = null;
  for (const v of versions) {
    if (v.salarieId !== salarieId || v.planId !== planId || v.moisEffet > mois) continue;
    if (!retenue || v.moisEffet > retenue.moisEffet) retenue = v;
  }
  return retenue;
}

/** Un bulletin à passer, avec son salarié · la répartition est celle du salarié. */
export type BulletinVentile = BulletinAComptabiliser & { readonly salarieId: string };

/**
 * La clé qui relie une ligne de l'écriture aux parts des bulletins, `null`
 * pour la reprise recopiée de l'écriture d'origine (bloc à part). Une ligne
 * de reprise rejouée (`negatif`) porte la même clé que sa ligne positive ·
 * ses parts se lisent sur les bulletins annulés.
 */
export function cleDeLaLigne(l: LigneDuMois, referentiel: Referentiel): string | null {
  if (l.bloc === 'REPRISE_EN_NEGATIF') return null;
  const total = TOTAL_DU_BLOC[l.bloc];
  // Ligne paie-suite, fonction 76 · le total du 422 éclaté par compte de
  // salarié reste une ligne de total · ses parts sont celles de SES bulletins
  // (`bulletinIds`, filtrées par l'appelant).
  if (l.bulletinIds) return `${l.bloc}|TOTAL`;
  if (!l.negatif && l.compte === compteDuRole(total.role, referentiel) && l.sens === total.sens) return `${l.bloc}|TOTAL`;
  return `${l.bloc}|${l.compte}|${l.sens}`;
}

/**
 * La part de chaque bulletin dans chaque ligne, en centimes · la même
 * addition que la passation (`propositionPaieDuMois`) · chaque détail arrondi
 * au centime, la ligne de total d'un bloc égale à la somme de ses détails.
 */
export function partsDesBulletins(
  bulletins: readonly (BulletinAComptabiliser & { readonly id: string })[],
  referentiel: Referentiel,
): Map<string, Map<string, number>> {
  const parts = new Map<string, Map<string, number>>();
  const ajouter = (cle: string, bulletinId: string, centimes: number) => {
    const m = parts.get(cle) ?? new Map<string, number>();
    m.set(bulletinId, (m.get(bulletinId) ?? 0) + centimes);
    parts.set(cle, m);
  };
  for (const b of bulletins) {
    const entree = entreeDuBulletin(b, referentiel);
    if (!entree) continue;
    const v = passationPaie(entree);
    if (v.refus.length > 0) continue;
    for (const l of v.lignes) {
      const total = TOTAL_DU_BLOC[l.bloc as BlocPaie];
      if (l.compte === compteDuRole(total.role, referentiel) && l.sens === total.sens) continue;
      const centimes = Math.round(l.montantFc * 100);
      ajouter(`${l.bloc}|${l.compte}|${l.sens}`, b.id, centimes);
      ajouter(`${l.bloc}|TOTAL`, b.id, centimes);
    }
  }
  return parts;
}

export type VentilationDeLigne = {
  readonly planId: string;
  readonly planCode: string;
  readonly sectionId: string;
  readonly sectionCode: string;
  readonly montantFc: number;
};

/** Pourquoi une ligne part sans ventilation sur un plan · l'écran trie par la cause, jamais par le texte. */
export type CauseNonVentilee =
  | 'AUCUNE_REPARTITION_DU_PLAN'
  | 'SANS_REPARTITION'
  | 'REPARTITION_VIDE'
  | 'SECTION_HORS_USAGE'
  /** Relecture M3 · la ligne de la pièce d'origine que la reprise annule n'est pas ventilée sur ce plan. */
  | 'ORIGINE_NON_VENTILEE'
  /** Relecture M3 · la pièce d'origine portait d'autres bulletins, et sa ventilation ne se refait pas par leurs répartitions. */
  | 'ORIGINE_NON_RECONSTITUEE'
  /** Les parts des bulletins ne refont pas la ligne au centime · rien ne se répartit d'office. */
  | 'PART_ILLISIBLE';

export type LigneNonVentilee = {
  readonly index: number;
  readonly compte: string;
  readonly intitule: string;
  readonly planCode: string;
  readonly cause: CauseNonVentilee;
  readonly motif: string;
  /** L'issue qui lève le refus d'un plan à ventilation obligatoire · selon la cause (relecture M3). */
  readonly issue: string;
};

export type VentilationDeLaPaie = {
  /** Aligné sur les lignes de la proposition · les ventilations de chaque ligne, tous plans. */
  readonly parLigne: readonly (readonly VentilationDeLigne[])[];
  readonly nonVentilees: readonly LigneNonVentilee[];
  readonly reserves: readonly string[];
};

/** Une écriture d'origine reprise en négatif ce mois, avec les bulletins annulés qu'elle passait. */
export type RepriseAVentiler = {
  readonly mode: 'EXACTE' | 'REJEU';
  readonly origine: OrigineDuBulletin;
  /** Les bulletins annulés que cette passation reprend. */
  readonly bulletins: readonly BulletinAComptabiliser[];
  /** REJEU · TOUS les bulletins que la pièce d'origine a passés, annulés compris, avec leur salarié. */
  readonly portes?: readonly BulletinVentile[];
};

/** Division entière vers moins l'infini · un BigInt se tronque vers zéro, ce qui fausse le plus fort reste d'une part négative. */
function divisionPlancher(a: bigint, d: bigint): bigint {
  const q = a / d;
  return a % d !== 0n && (a < 0n) !== (d < 0n) ? q - 1n : q;
}

/**
 * Répartir `total` centimes selon des parts exactes (centimes × points de
 * base), par le plus fort reste · BigInt, un salaire en centimes multiplié
 * par 10 000 dépassant l'entier sûr des flottants. Les parts peuvent être
 * NÉGATIVES (reprise d'un bulletin annulé, relecture M3) · chacune se prend
 * au plancher, et les centimes qui manquent pour faire le total vont aux
 * plus forts restes, toujours positifs.
 */
function auPlusFortReste(exactes: Map<string, bigint>, total: number, codeDe: (sectionId: string) => string): Map<string, number> {
  const rendus = new Map<string, number>();
  const restes: { sectionId: string; reste: bigint }[] = [];
  let distribue = 0;
  for (const [sectionId, exacte] of exactes) {
    const base = divisionPlancher(exacte, 10_000n);
    rendus.set(sectionId, Number(base));
    distribue += Number(base);
    restes.push({ sectionId, reste: exacte - base * 10_000n });
  }
  restes.sort((a, b) => (a.reste === b.reste ? codeDe(a.sectionId).localeCompare(codeDe(b.sectionId)) : a.reste > b.reste ? -1 : 1));
  for (let i = 0; i < total - distribue && restes.length > 0; i++) {
    const s = restes[i % restes.length].sectionId;
    rendus.set(s, (rendus.get(s) ?? 0) + 1);
  }
  return rendus;
}

/**
 * LA VENTILATION DE L'ÉCRITURE DE PAIE. `bulletins` sont ceux que l'écriture
 * passe (les positifs) ; `plans` les plans ACTIFS du dossier ; `versions` les
 * répartitions non retirées ; `reprises` les écritures d'origine que la
 * passation reprend en négatif.
 *
 * RELECTURE M3 · LA REPRISE EN NÉGATIF SE VENTILE COMME L'ÉCRITURE D'ORIGINE.
 * Elle annule ce qui a été passé (AUDCIF art. 20, al. 2) · ses lignes
 * reçoivent, en négatif, la ventilation de la pièce d'origine · recopiée
 * ligne à ligne quand la reprise l'est (EXACTE) ; rejouée (REJEU), la part du
 * bulletin annulé dans la ligne d'origine, que la pièce ne dit pas, se lit en
 * refaisant sa ventilation par les répartitions de ses bulletins, au centime,
 * jamais au prorata (deux salariés sur deux projets n'ont pas la même part).
 * Une ligne d'origine non ventilée sur le plan laisse la reprise non
 * ventilée, cause et pièce nommées · sans quoi un plan à ventilation
 * obligatoire refusait la paie du mois au nom d'une répartition à déclarer,
 * issue qui ne levait rien.
 */
export function ventilerLaPaie(params: {
  readonly mois: string;
  readonly referentiel: Referentiel;
  readonly lignes: readonly LigneDuMois[];
  readonly bulletins: readonly BulletinVentile[];
  readonly plans: readonly PlanConnu[];
  readonly sections: readonly SectionConnue[];
  readonly versions: readonly VersionRepartition[];
  readonly reprises?: readonly RepriseAVentiler[];
}): VentilationDeLaPaie {
  const { mois, referentiel, lignes, bulletins, plans, sections, versions } = params;
  const reprises = params.reprises ?? [];
  const parLigne: VentilationDeLigne[][] = lignes.map(() => []);
  const nonVentilees: LigneNonVentilee[] = [];
  const reserves: string[] = [];
  const parts = partsDesBulletins(bulletins, referentiel);
  const rejoues = reprises.filter((r) => r.mode === 'REJEU').flatMap((r) => r.bulletins.map((b) => ({ b, reprise: r })));
  const partsRejouees = partsDesBulletins(
    rejoues.map((x) => x.b),
    referentiel,
  );
  const repriseDuRejoue = new Map(rejoues.map((x) => [x.b.id, x.reprise]));
  const partsDesPortes = new Map(reprises.map((r) => [r, partsDesBulletins(r.portes ?? [], referentiel)]));
  const exactes = reprises.filter((r) => r.mode === 'EXACTE').map((r) => r.origine);
  const bulletinDe = new Map(bulletins.map((b) => [b.id, b]));
  const sectionDe = new Map(sections.map((s) => [s.id, s]));
  const codeDe = (id: string) => sectionDe.get(id)?.code ?? id;
  const enUsage = (sectionId: string, planId: string) => {
    const s = sectionDe.get(sectionId);
    return !!s && s.planId === planId && !s.estTotal && s.estActive;
  };

  /**
   * Ce que la pièce d'origine a ventilé sur le plan pour un compte et un
   * sens · par section, en centimes, avec le montant des lignes · ou la
   * cause qui l'empêche.
   */
  const ventilationDOrigine = (
    origine: OrigineDuBulletin,
    compte: string,
    sens: 'DEBIT' | 'CREDIT',
    plan: PlanConnu,
  ): { montant: number; parSection: Map<string, number> } | { cause: CauseNonVentilee; texte: string } => {
    const piece = `pièce d'origine n° ${origine.numeroPiece ?? '·'}`;
    const lignesO = origine.lignes.filter((x) => x.compte === compte && Math.round((sens === 'DEBIT' ? x.debit : x.credit) * 100) !== 0);
    let montant = 0;
    const parSection = new Map<string, number>();
    for (const x of lignesO) {
      const m = Math.round((sens === 'DEBIT' ? x.debit : x.credit) * 100);
      montant += m;
      const surLePlan = (x.ventilations ?? []).filter((v) => v.planId === plan.id);
      const ventile = surLePlan.reduce((n, v) => n + Math.round(v.montant * 100), 0);
      if (surLePlan.length === 0 || ventile !== m) {
        return { cause: 'ORIGINE_NON_VENTILEE', texte: `la ligne ${compte} de la ${piece} n'est pas ventilée en totalité sur ce plan` };
      }
      for (const v of surLePlan) {
        if (!enUsage(v.sectionId, plan.id)) {
          return {
            cause: 'SECTION_HORS_USAGE',
            texte: `la section ${codeDe(v.sectionId)} de la ${piece} est en sommeil ou n'est plus une section Détail`,
          };
        }
        parSection.set(v.sectionId, (parSection.get(v.sectionId) ?? 0) + Math.round(v.montant * 100));
      }
    }
    if (lignesO.length === 0) return { cause: 'ORIGINE_NON_VENTILEE', texte: `la ${piece} ne porte aucune ligne ${compte} de ce sens` };
    return { montant, parSection };
  };

  /**
   * La ventilation d'une ligne d'origine refaite par les répartitions des
   * bulletins qu'elle portait · les parts exactes de chacun, par section ·
   * ou la cause qui l'empêche.
   */
  const refaireLOrigine = (
    reprise: RepriseAVentiler,
    cle: string,
    o: { montant: number; parSection: Map<string, number> },
    plan: PlanConnu,
  ): Map<string, Map<string, bigint>> | { cause: CauseNonVentilee; texte: string } => {
    const nonRefaite = {
      cause: 'ORIGINE_NON_RECONSTITUEE' as const,
      texte: `la ventilation de la pièce d'origine n° ${reprise.origine.numeroPiece ?? '·'} ne se refait pas par les répartitions de ses bulletins`,
    };
    const parts = partsDesPortes.get(reprise)?.get(cle) ?? new Map<string, number>();
    if ([...parts.values()].reduce((n, c) => n + c, 0) !== o.montant) return nonRefaite;
    const parBulletin = new Map<string, Map<string, bigint>>();
    const somme = new Map<string, bigint>();
    for (const b of reprise.portes ?? []) {
      const centimes = parts.get(b.id) ?? 0;
      if (centimes === 0) continue;
      const version = versionDuMois(versions.filter((v) => v.planId === plan.id), b.salarieId, plan.id, mois);
      if (!version || version.lignes.length === 0) return nonRefaite;
      const siennes = new Map<string, bigint>();
      for (const r of version.lignes) {
        const points = enPointsDeBase(r.pourcentage);
        if (points === null) return nonRefaite;
        const exacte = BigInt(centimes) * BigInt(points);
        siennes.set(r.sectionId, (siennes.get(r.sectionId) ?? 0n) + exacte);
        somme.set(r.sectionId, (somme.get(r.sectionId) ?? 0n) + exacte);
      }
      parBulletin.set(b.id, siennes);
    }
    const refaite = auPlusFortReste(somme, o.montant, codeDe);
    const sections = new Set([...refaite.keys(), ...o.parSection.keys()]);
    for (const sectionId of sections) {
      if ((refaite.get(sectionId) ?? 0) !== (o.parSection.get(sectionId) ?? 0)) return nonRefaite;
    }
    return parBulletin;
  };

  for (const plan of plans.filter((p) => p.estActif)) {
    const declarees = versions.filter((v) => v.planId === plan.id);
    const aVentiler = lignes
      .map((l, index) => ({ l, index }))
      .filter(({ l }) => motifRefusClasseVentilee(l.compte.charAt(0), plan.classesVentilees) === null);
    if (aVentiler.length === 0) continue;

    const sansRepartition = new Set<string>();
    const repartitionVide = new Set<string>();
    const sectionsHorsUsage = new Set<string>();
    let aucuneRepartition = 0;
    for (const { l, index } of aVentiler) {
      const nonVentilee = (cause: CauseNonVentilee, motif: string) => {
        // Un plan sur lequel la paie n'a jamais rien ventilé (aucune
        // répartition déclarée) ne reproche pas à la reprise une pièce
        // d'origine qu'il n'a jamais reçue · c'est le cas du plan sans
        // répartition, dit d'une phrase.
        if (cause === 'ORIGINE_NON_VENTILEE' && declarees.length === 0) {
          aucuneRepartition += 1;
          cause = 'AUCUNE_REPARTITION_DU_PLAN';
          motif = 'aucune répartition de la paie déclarée sur ce plan';
        }
        nonVentilees.push({ index, compte: l.compte, intitule: l.intitule, planCode: plan.code, cause, motif, issue: issueDeLaCause(cause) });
      };
      const total = Math.round(l.montantFc * 100);
      const exactesDeLaLigne = new Map<string, bigint>();
      const ajouter = (sectionId: string, centimesFois10000: bigint) =>
        exactesDeLaLigne.set(sectionId, (exactesDeLaLigne.get(sectionId) ?? 0n) + centimesFois10000);

      // LA REPRISE RECOPIÉE (EXACTE) · la ventilation de chaque ligne
      // d'origine de même compte et de même sens, en négatif.
      if (l.bloc === 'REPRISE_EN_NEGATIF') {
        let refus: { cause: CauseNonVentilee; texte: string } | null = null;
        for (const origine of exactes) {
          if (!origine.lignes.some((x) => x.compte === l.compte && Math.round((l.sens === 'DEBIT' ? x.debit : x.credit) * 100) !== 0)) continue;
          const o = ventilationDOrigine(origine, l.compte, l.sens, plan);
          if ('cause' in o) {
            refus = o;
            break;
          }
          for (const [sectionId, c] of o.parSection) ajouter(sectionId, -BigInt(c) * 10_000n);
        }
        const somme = [...exactesDeLaLigne.values()].reduce((n, x) => n + x, 0n);
        if (refus) nonVentilee(refus.cause, refus.texte);
        else if (somme !== BigInt(total) * 10_000n || somme === 0n) nonVentilee('PART_ILLISIBLE', 'la reprise ne se relit pas sur ses pièces d’origine');
        else poser(index, plan, auPlusFortReste(exactesDeLaLigne, total, codeDe));
        continue;
      }

      const cle = cleDeLaLigne(l, referentiel) as string;
      // Fonction 76 · une part du total du 422 ne lit que ses bulletins.
      const siens = (m: Map<string, number>) => (l.bulletinIds ? new Map([...m].filter(([id]) => l.bulletinIds!.includes(id))) : m);
      const positives = l.negatif ? new Map<string, number>() : siens(parts.get(cle) ?? new Map<string, number>());
      const negatives = l.negatif || cle.endsWith('|TOTAL') ? siens(partsRejouees.get(cle) ?? new Map<string, number>()) : new Map<string, number>();
      const somme = [...positives.values()].reduce((n, c) => n + c, 0) - [...negatives.values()].reduce((n, c) => n + c, 0);
      if (somme !== total || total === 0) {
        nonVentilee('PART_ILLISIBLE', 'les parts des bulletins ne refont pas la ligne au centime');
        continue;
      }

      // LES BULLETINS PASSÉS · la répartition de leur salarié en vigueur au mois.
      const manquants: string[] = [];
      let motif: { cause: CauseNonVentilee; texte: string } | null = null;
      if ([...positives.values()].some((c) => c !== 0) && declarees.length === 0) {
        aucuneRepartition += 1;
        nonVentilee('AUCUNE_REPARTITION_DU_PLAN', 'aucune répartition de la paie déclarée sur ce plan');
        continue;
      }
      for (const [bulletinId, centimes] of positives) {
        if (centimes === 0) continue;
        const b = bulletinDe.get(bulletinId)!;
        const version = versionDuMois(declarees, b.salarieId, plan.id, mois);
        if (!version) {
          manquants.push(b.nomComplet);
          sansRepartition.add(b.nomComplet);
          continue;
        }
        if (version.lignes.length === 0) {
          repartitionVide.add(b.nomComplet);
          motif = { cause: 'REPARTITION_VIDE', texte: `${b.nomComplet} n'est plus réparti sur ce plan depuis ${version.moisEffet}` };
          continue;
        }
        for (const r of version.lignes) {
          const s = sectionDe.get(r.sectionId);
          if (!s || !enUsage(r.sectionId, plan.id)) {
            sectionsHorsUsage.add(s?.code ?? r.sectionId);
            motif = {
              cause: 'SECTION_HORS_USAGE',
              texte: `la section ${s?.code ?? r.sectionId} de la répartition de ${b.nomComplet} est en sommeil ou n'est plus une section Détail`,
            };
            continue;
          }
          // Deux décimales au plus, tenues par la base (Decimal 5,2) · une part
          // illisible ne se lit pas comme zéro, la ligne part non ventilée.
          const points = enPointsDeBase(r.pourcentage);
          if (points === null) {
            motif = { cause: 'SECTION_HORS_USAGE', texte: `la part de la section ${s.code} dans la répartition de ${b.nomComplet} est illisible` };
            continue;
          }
          ajouter(s.id, BigInt(centimes) * BigInt(points));
        }
      }
      // LES BULLETINS ANNULÉS REJOUÉS (relecture M3) · la pièce d'origine
      // portait d'autres bulletins, et sa ligne ne dit pas la part de chacun ·
      // elle se refait par les répartitions de ses bulletins au mois, la règle
      // qui l'a ventilée. Refaite au centime, la part du bulletin annulé se
      // reprend en négatif, section par section ; sinon (répartition changée,
      // ventilation posée à la main), rien ne se devine, la cause est dite.
      for (const [bulletinId, centimes] of negatives) {
        if (centimes === 0 || motif) continue;
        const reprise = repriseDuRejoue.get(bulletinId);
        if (!reprise) {
          motif = { cause: 'PART_ILLISIBLE', texte: 'la pièce d’origine d’un bulletin annulé n’est pas lue' };
          continue;
        }
        const o = ventilationDOrigine(reprise.origine, l.compte, l.sens, plan);
        if ('cause' in o) {
          motif = o;
          continue;
        }
        const refaite = refaireLOrigine(reprise, cle, o, plan);
        if ('cause' in refaite) {
          motif = refaite;
          continue;
        }
        for (const [sectionId, exacte] of refaite.get(bulletinId) ?? new Map<string, bigint>()) ajouter(sectionId, -exacte);
      }
      if (manquants.length > 0) {
        nonVentilee('SANS_REPARTITION', `sans répartition · ${manquants.join(', ')}`);
        continue;
      }
      if (motif) {
        nonVentilee(motif.cause, motif.texte);
        continue;
      }
      poser(index, plan, auPlusFortReste(exactesDeLaLigne, total, codeDe));
    }

    if (aucuneRepartition > 0) {
      reserves.push(
        `Plan ${plan.code} · aucune répartition de la paie n'y est déclarée · ${aucuneRepartition} ligne(s) de l'écriture, ` +
          'dans une classe que le plan ventile, partent sans ventilation (Registre du personnel, Répartition analytique).',
      );
    }
    if (sansRepartition.size > 0) {
      reserves.push(
        `Plan ${plan.code} · ${[...sansRepartition].join(', ')} n'a (n'ont) aucune répartition en vigueur pour ${mois} · ` +
          'les lignes où sa part entre partent sans ventilation sur ce plan, rien n’étant réparti au prorata des autres.',
      );
    }
    if (repartitionVide.size > 0) {
      reserves.push(
        `Plan ${plan.code} · ${[...repartitionVide].join(', ')} n'est (ne sont) plus réparti(s) sur ce plan · les lignes où sa part entre partent sans ventilation.`,
      );
    }
    if (sectionsHorsUsage.size > 0) {
      reserves.push(
        `Plan ${plan.code} · la (les) section(s) ${[...sectionsHorsUsage].join(', ')} d'une répartition est (sont) en sommeil ou n'est (ne sont) plus Détail · ` +
          'déclarez une nouvelle répartition ; les lignes concernées partent sans ventilation.',
      );
    }
  }

  if (nonVentilees.some((n) => n.cause === 'ORIGINE_NON_VENTILEE')) {
    reserves.push(ISSUE_ORIGINE_NON_VENTILEE);
  }
  return { parLigne, nonVentilees, reserves };

  function poser(index: number, plan: PlanConnu, rendus: Map<string, number>) {
    for (const [sectionId, centimes] of [...rendus].sort((a, b) => codeDe(a[0]).localeCompare(codeDe(b[0])))) {
      if (centimes === 0) continue;
      parLigne[index].push({ planId: plan.id, planCode: plan.code, sectionId, sectionCode: codeDe(sectionId), montantFc: centimes / 100 });
    }
  }
}

/**
 * L'ISSUE QUI LÈVE LE REFUS d'une reprise dont la pièce d'origine n'est pas
 * ventilée · elle se ventile d'abord, quand son exercice et sa période le
 * permettent ; sinon le plan ne peut pas l'exiger de cette reprise, et
 * l'obligation se lève le temps de passer, la reprise se ventilant ensuite à
 * la main.
 */
export const ISSUE_ORIGINE_NON_VENTILEE =
  "REPRISE EN NÉGATIF · la pièce d'origine n'est pas ventilée sur le plan nommé, et la reprise se ventile comme elle. " +
  "Ventilez d'abord la pièce d'origine (Ventilation d'une ligne), si son exercice est ouvert et sa période non close ; " +
  "sinon, levez l'obligation de ventilation du plan (Plans analytiques), passez la paie, ventilez la reprise ligne à ligne, " +
  "puis rétablissez l'obligation.";

/** L'issue d'une ligne non ventilée, selon sa cause · celle que la passation refusée doit dire. */
export function issueDeLaCause(cause: CauseNonVentilee): string {
  switch (cause) {
    case 'AUCUNE_REPARTITION_DU_PLAN':
    case 'SANS_REPARTITION':
    case 'REPARTITION_VIDE':
      return 'Déclarez la répartition des salariés nommés (Registre du personnel, Répartition analytique).';
    case 'SECTION_HORS_USAGE':
      return 'Déclarez une nouvelle répartition sur des sections Détail actives, ou réactivez la section nommée.';
    case 'ORIGINE_NON_VENTILEE':
      return ISSUE_ORIGINE_NON_VENTILEE;
    case 'ORIGINE_NON_RECONSTITUEE':
    case 'PART_ILLISIBLE':
      return "Levez l'obligation de ventilation du plan (Plans analytiques), passez la paie, ventilez la ligne à la main en reprenant la part du bulletin annulé, puis rétablissez l'obligation.";
  }
}
