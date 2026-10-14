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
 * ligne qui mêle la reprise en négatif d'un bulletin annulé · la ligne part
 * sans ventilation sur ce plan, et la proposition nomme la ligne, le plan et
 * la cause. Rien n'est réparti au prorata des autres salariés · ce serait
 * porter sur une section une dépense qu'elle n'a pas (audit final F141).
 *
 * AU CENTIME, PAR LE PLUS FORT RESTE · les parts exactes (centimes × points
 * de base) se tronquent, et les centimes qui manquent vont aux sections dont
 * le reste est le plus fort, à égalité par le code de la section. La somme
 * par plan égale la ligne au centime, ce que la saisie exige.
 */
import { moisValide } from './bulletin-paie';
import { entreeDuBulletin, TOTAL_DU_BLOC, type BulletinAComptabiliser, type LigneDuMois } from './comptabilisation-paie';
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

/** La clé qui relie une ligne de l'écriture aux parts des bulletins, `null` pour une reprise en négatif. */
export function cleDeLaLigne(l: LigneDuMois, referentiel: Referentiel): string | null {
  if (l.negatif || l.bloc === 'REPRISE_EN_NEGATIF') return null;
  const total = TOTAL_DU_BLOC[l.bloc];
  if (l.compte === compteDuRole(total.role, referentiel) && l.sens === total.sens) return `${l.bloc}|TOTAL`;
  return `${l.bloc}|${l.compte}|${l.sens}`;
}

/**
 * La part de chaque bulletin dans chaque ligne, en centimes · la même
 * addition que la passation (`propositionPaieDuMois`) · chaque détail arrondi
 * au centime, la ligne de total d'un bloc égale à la somme de ses détails.
 */
export function partsDesBulletins(
  bulletins: readonly BulletinVentile[],
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
  | 'REPRISE_EN_NEGATIF';

export type LigneNonVentilee = {
  readonly index: number;
  readonly compte: string;
  readonly intitule: string;
  readonly planCode: string;
  readonly cause: CauseNonVentilee;
  readonly motif: string;
};

export type VentilationDeLaPaie = {
  /** Aligné sur les lignes de la proposition · les ventilations de chaque ligne, tous plans. */
  readonly parLigne: readonly (readonly VentilationDeLigne[])[];
  readonly nonVentilees: readonly LigneNonVentilee[];
  readonly reserves: readonly string[];
};

/**
 * Répartir `total` centimes selon des parts exactes (centimes × points de
 * base), par le plus fort reste · BigInt, un salaire en centimes multiplié
 * par 10 000 dépassant l'entier sûr des flottants.
 */
function auPlusFortReste(
  exactes: Map<string, bigint>,
  total: number,
  codeDe: (sectionId: string) => string,
): Map<string, number> {
  const rendus = new Map<string, number>();
  const restes: { sectionId: string; reste: bigint }[] = [];
  let distribue = 0;
  for (const [sectionId, exacte] of exactes) {
    const base = Number(exacte / 10_000n);
    rendus.set(sectionId, base);
    distribue += base;
    restes.push({ sectionId, reste: exacte % 10_000n });
  }
  restes.sort((a, b) =>
    a.reste === b.reste ? codeDe(a.sectionId).localeCompare(codeDe(b.sectionId)) : a.reste > b.reste ? -1 : 1,
  );
  for (let i = 0; i < total - distribue; i++) {
    const s = restes[i % restes.length].sectionId;
    rendus.set(s, (rendus.get(s) ?? 0) + 1);
  }
  return rendus;
}

/**
 * LA VENTILATION DE L'ÉCRITURE DE PAIE. `bulletins` sont ceux que l'écriture
 * passe (les positifs) ; `plans` les plans ACTIFS du dossier ; `versions` les
 * répartitions non retirées.
 */
export function ventilerLaPaie(params: {
  readonly mois: string;
  readonly referentiel: Referentiel;
  readonly lignes: readonly LigneDuMois[];
  readonly bulletins: readonly BulletinVentile[];
  readonly plans: readonly PlanConnu[];
  readonly sections: readonly SectionConnue[];
  readonly versions: readonly VersionRepartition[];
}): VentilationDeLaPaie {
  const { mois, referentiel, lignes, bulletins, plans, sections, versions } = params;
  const parLigne: VentilationDeLigne[][] = lignes.map(() => []);
  const nonVentilees: LigneNonVentilee[] = [];
  const reserves: string[] = [];
  const parts = partsDesBulletins(bulletins, referentiel);
  const bulletinDe = new Map(bulletins.map((b) => [b.id, b]));
  const sectionDe = new Map(sections.map((s) => [s.id, s]));
  const codeDe = (id: string) => sectionDe.get(id)?.code ?? id;

  for (const plan of plans.filter((p) => p.estActif)) {
    const declarees = versions.filter((v) => v.planId === plan.id);
    const aVentiler = lignes
      .map((l, index) => ({ l, index }))
      .filter(({ l }) => motifRefusClasseVentilee(l.compte.charAt(0), plan.classesVentilees) === null);
    if (aVentiler.length === 0) continue;

    // Aucune répartition déclarée sur ce plan · une seule phrase, la paie ne
    // ventile rien sur lui.
    if (declarees.length === 0) {
      for (const { l, index } of aVentiler) {
        nonVentilees.push({
          index,
          compte: l.compte,
          intitule: l.intitule,
          planCode: plan.code,
          cause: 'AUCUNE_REPARTITION_DU_PLAN',
          motif: 'aucune répartition de la paie déclarée sur ce plan',
        });
      }
      reserves.push(
        `Plan ${plan.code} · aucune répartition de la paie n'y est déclarée · ${aVentiler.length} ligne(s) de l'écriture, ` +
          'dans une classe que le plan ventile, partent sans ventilation (Registre du personnel, Répartition analytique).',
      );
      continue;
    }

    const sansRepartition = new Set<string>();
    const repartitionVide = new Set<string>();
    const sectionsHorsUsage = new Set<string>();
    for (const { l, index } of aVentiler) {
      const cle = cleDeLaLigne(l, referentiel);
      const nonVentilee = (cause: CauseNonVentilee, motif: string) =>
        nonVentilees.push({ index, compte: l.compte, intitule: l.intitule, planCode: plan.code, cause, motif });
      if (cle === null) {
        nonVentilee('REPRISE_EN_NEGATIF', 'reprise en négatif d’un bulletin annulé');
        continue;
      }
      const total = Math.round(l.montantFc * 100);
      const duBulletin = parts.get(cle) ?? new Map<string, number>();
      const somme = [...duBulletin.values()].reduce((n, c) => n + c, 0);
      // La ligne mêle la reprise en négatif d'un bulletin annulé (total d'un
      // bloc), ou une part ne se relit pas · ni l'une ni l'autre ne se
      // répartit d'office.
      if (somme !== total || [...duBulletin.values()].some((c) => c < 0) || total <= 0) {
        nonVentilee('REPRISE_EN_NEGATIF', 'la ligne mêle la reprise en négatif d’un bulletin annulé');
        continue;
      }
      const exactes = new Map<string, bigint>();
      const manquants: string[] = [];
      let motif: { cause: CauseNonVentilee; texte: string } | null = null;
      for (const [bulletinId, centimes] of duBulletin) {
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
          if (!s || s.planId !== plan.id || s.estTotal || !s.estActive) {
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
          exactes.set(s.id, (exactes.get(s.id) ?? 0n) + BigInt(centimes) * BigInt(points));
        }
      }
      if (manquants.length > 0) {
        nonVentilee('SANS_REPARTITION', `sans répartition · ${manquants.join(', ')}`);
        continue;
      }
      if (motif) {
        nonVentilee(motif.cause, motif.texte);
        continue;
      }
      const rendus = auPlusFortReste(exactes, total, codeDe);
      for (const [sectionId, centimes] of [...rendus].sort((a, b) => codeDe(a[0]).localeCompare(codeDe(b[0])))) {
        if (centimes === 0) continue;
        parLigne[index].push({ planId: plan.id, planCode: plan.code, sectionId, sectionCode: codeDe(sectionId), montantFc: centimes / 100 });
      }
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

  if (nonVentilees.some((n) => n.cause === 'REPRISE_EN_NEGATIF')) {
    reserves.push(
      "REPRISE EN NÉGATIF · ses lignes ne se ventilent pas d'office · ventilez-les à la main (Ventilation d'une ligne) " +
        "en reprenant la ventilation de la pièce d'origine.",
    );
  }
  return { parLigne, nonVentilees, reserves };
}
