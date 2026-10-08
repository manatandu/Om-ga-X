import { echeanceDepassee } from '../../common/echeance';
import { RACINE_4428 } from './inpp-onem-du-4428';

/**
 * L'INPP SE PAIE PAR TRIMESTRE · ordonnance n° 84/186 du 15 octobre 1984
 * fixant les modalités de paiement de la cotisation due par les employeurs à
 * l'Institut national de préparation professionnelle (compétence
 * `droit-travail-congolais`, `smig-cotisations-textes-application/
 * ordonnance-84-186-inpp-modalites-paiement.md`, recopiée dans
 * `docs/sources/ordonnance-84-186-inpp-modalites-paiement.md`).
 *
 * Le registre des retenues datait l'INPP au 15 du mois suivant, comme l'ONEM
 * avec qui il partage le 4428 (décision T1). Aucun texte ne donnait ce 15 à
 * l'INPP · le Code du travail (art. 15 b) dit la cotisation « mensuelle » et
 * ne fixe aucune échéance, les arrêtés de taux de 2006 et de 2025 non plus.
 * L'ordonnance, elle, en fixe quatre · art. 1er, « Tout employeur est tenu de
 * payer la cotisation TRIMESTRIELLE » ; art. 3, al. 2, « Ces versements ont
 * lieu, au plus tard, pour les quatre trimestres de l'année, respectivement
 * le 30 avril, le 31 juillet, le 31 octobre et le 31 janvier de l'année
 * suivante ». Un mois de janvier impayé était donc « en retard » au 16
 * février, deux mois et demi avant son échéance · un contrôle qui FABRIQUE
 * une anomalie (CLAUDE.md, § 10 bis).
 *
 * L'ORDONNANCE EST EN VIGUEUR · Code du travail, art. 17 (les textes pris pour
 * l'ordonnance-loi n° 206 du 29 juin 1964 « qui ne sont pas contraires aux
 * dispositions du présent titre demeurent en vigueur ») et art. 332, al. 2 ;
 * les deux arrêtés de taux la visent. Elle renvoie à l'art. 185 du Code de
 * 1967, devenu l'art. 15 du Code de 2002.
 *
 * « MENSUELLE » ET « TRIMESTRIELLE » · UNE LECTURE, PAS UN TEXTE (relecture
 * adverse, mineur a). L'art. 15 b) dit « la cotisation mensuelle des
 * employeurs proportionnelle à la somme des rémunérations versées par eux à
 * leur personnel au cours du trimestre précédent », et les arrêtés fixent le
 * taux « sur les rémunérations versées ». La paie d'OmegaX calcule la
 * cotisation de chaque mois sur les rémunérations versées ce mois-là, au taux
 * du jour du versement (décision T5), et tient la somme des trois mois pour
 * la cotisation du trimestre que l'art. 3 fait verser après le trimestre
 * écoulé · le « trimestre précédent » serait celui qui précède le versement.
 * L'autre lecture prend pour assiette les rémunérations du trimestre
 * précédent, ce qui décale la cotisation d'un trimestre ; aucun texte ne
 * tranche, et `RESERVE_ASSIETTE_INPP` le dit sur chaque bulletin. Les
 * échéances de ce module ne dépendent pas de ce choix · le registre lit les
 * montants passés au 4428, quelle que soit l'assiette qui les a produits.
 *
 * AUCUN REPORT AU JOUR OUVRABLE · l'ordonnance n'en prévoit pas, et le report
 * de l'art. 110 bis, al. 2 de la loi de procédures fiscales ne vise que « le
 * délai prescrit par la législation fiscale » (passe D2, `jour-ouvrable.ts`).
 * Le 31 janvier 2027 est un dimanche · l'échéance reste le 31 janvier.
 */

export const ORDONNANCE_84_186 =
  "ordonnance n° 84/186 du 15 octobre 1984 fixant les modalités de paiement de la cotisation due par les employeurs à l'INPP";

/**
 * Art. 3, al. 2 · les quatre échéances, dans l'ordre des trimestres civils.
 * Écrites comme le texte les écrit (mois et jour), jamais calculées comme
 * « la fin du mois qui suit le trimestre » · c'est la même chose aujourd'hui,
 * mais une table se relit contre le texte, une formule non.
 */
export const ECHEANCES_TRIMESTRIELLES_INPP: readonly {
  readonly trimestre: 1 | 2 | 3 | 4;
  /** Mois de l'échéance, 0 = janvier. */
  readonly moisZeroBase: number;
  readonly jour: number;
  /** Le 4e trimestre se paie l'année suivante (« de l'année suivante »). */
  readonly anneeSuivante: boolean;
}[] = [
  { trimestre: 1, moisZeroBase: 3, jour: 30, anneeSuivante: false },
  { trimestre: 2, moisZeroBase: 6, jour: 31, anneeSuivante: false },
  { trimestre: 3, moisZeroBase: 9, jour: 31, anneeSuivante: false },
  { trimestre: 4, moisZeroBase: 0, jour: 31, anneeSuivante: true },
];

/**
 * L'échéance de la cotisation INPP d'un mois · celle du trimestre civil qui le
 * contient (art. 3, al. 2). `moisZeroBase` peut déborder (-1 = décembre de
 * l'année précédente), comme dans `echeanceDeReversement`.
 */
export function echeanceTrimestrielleInpp(annee: number, moisZeroBase: number): Date {
  const mois = new Date(Date.UTC(annee, moisZeroBase, 1));
  const e = ECHEANCES_TRIMESTRIELLES_INPP[Math.floor(mois.getUTCMonth() / 3)];
  return new Date(Date.UTC(mois.getUTCFullYear() + (e.anneeSuivante ? 1 : 0), e.moisZeroBase, e.jour));
}

/**
 * La prochaine échéance INPP à partir d'un jour · la première qui n'est pas
 * dépassée (le jour même, le versement est encore dans le délai). Le 5
 * janvier, c'est le 31 janvier, échéance du quatrième trimestre écoulé.
 */
export function prochaineEcheanceInpp(reference: Date): Date {
  for (let annee = reference.getUTCFullYear() - 1; annee <= reference.getUTCFullYear() + 1; annee++) {
    for (let mois = 0; mois < 12; mois += 3) {
      const echeance = echeanceTrimestrielleInpp(annee, mois);
      if (!echeanceDepassee(echeance, reference)) return echeance;
    }
  }
  // Inatteignable · l'année suivante porte toujours une échéance future.
  return echeanceTrimestrielleInpp(reference.getUTCFullYear() + 1, 0);
}

/**
 * LA PART D'UNE LIGNE DE LA DETTE · l'INPP et l'ONEM partagent le 4428
 * (décision T1), et la passation de la paie n'y porte qu'UNE ligne de total
 * pour les deux (`comptabilisation-paie.ts`, bloc des impôts et taxes sur
 * salaires). Leurs échéances diffèrent désormais · la ligne se ventile par la
 * STRUCTURE de son écriture, jamais devinée ·
 *  - 4334 (dossier semé avant T1) · l'INPP par son intitulé ; 4335 · l'ONEM ;
 *  - 4428 · au prorata des charges de la même écriture, 6415 pour l'INPP et
 *    6413 pour l'ONEM (`passation-paie.ts`), seule mesure que le livre porte ;
 *  - sans ces charges, ou si elles ne se lisent pas en une proportion entre
 *    zéro et un · NON VENTILÉE, nommée par le registre, et datée à
 *    l'échéance de l'INPP, la plus tardive des deux · un retard n'est jamais
 *    affirmé avant qu'il soit certain (§ 10 bis).
 */
export type PartInppOnem = 'INPP' | 'ONEM' | 'NON_VENTILEE';

export const RACINE_CHARGE_INPP = '6415';
export const RACINE_CHARGE_ONEM = '6413';

export type ChargeDeLEcriture = { readonly debit: unknown; readonly credit: unknown; readonly compte: { readonly numero: string } };

const centimes = (v: number) => Math.round(v * 100) / 100;
const nombre = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ventilerInppOnem(
  montant: number,
  numeroCompte: string,
  chargesDeLEcriture: readonly ChargeDeLEcriture[] | undefined,
): Array<{ part: PartInppOnem; montant: number }> {
  if (numeroCompte.startsWith('4334')) return [{ part: 'INPP', montant }];
  if (numeroCompte.startsWith('4335')) return [{ part: 'ONEM', montant }];
  if (!numeroCompte.startsWith(RACINE_4428)) return [{ part: 'NON_VENTILEE', montant }];
  const solde = (racine: string) =>
    (chargesDeLEcriture ?? [])
      .filter((c) => c.compte?.numero?.startsWith(racine))
      .reduce((s, c) => s + nombre(c.debit) - nombre(c.credit), 0);
  const inpp = solde(RACINE_CHARGE_INPP);
  const onem = solde(RACINE_CHARGE_ONEM);
  const total = inpp + onem;
  const proportion = Math.abs(total) < 0.005 ? NaN : inpp / total;
  if (!Number.isFinite(proportion) || proportion < 0 || proportion > 1) return [{ part: 'NON_VENTILEE', montant }];
  const partInpp = centimes(montant * proportion);
  return [
    { part: 'ONEM' as const, montant: centimes(montant - partInpp) },
    { part: 'INPP' as const, montant: partInpp },
  ].filter((p) => Math.abs(p.montant) >= 0.005);
}

/**
 * L'ÉCHÉANCIER SERT DEUX LIGNES, UNE PAR TEXTE (relecture adverse du
 * 2026-10-08, MAJEUR). Servi en une seule ligne datée à la plus proche des
 * deux échéances (celle de l'ONEM), le solde entier du 4428 s'affichait à cette
 * date · le 1er novembre, octobre seul impayé, « 15 novembre · 40 000 dus »
 * pour 5 000 qui échoient ce jour-là, l'INPP d'octobre n'étant dû que le 31
 * janvier (ordonnance n° 84/186, art. 3). Chaque ligne porte SA prochaine
 * échéance, SA périodicité, et ce qui reste dû de SA part à cette date ·
 * échéances passées comprises (un retard reste dû), échéances postérieures
 * exclues. La part non ventilée et le solde d'ouverture en bloc vont avec
 * l'INPP, datés comme lui au trimestre (`mentionNonVentilee`).
 */
export type MoisDuRegistre = {
  readonly mois: string;
  readonly part: PartInppOnem | null;
  readonly solde: number;
  readonly echeance: Date;
  readonly enRetard: boolean;
};

export type LigneEcheancierInppOnem = {
  readonly part: 'ONEM' | 'INPP';
  readonly periodicite: 'MENSUELLE' | 'TRIMESTRIELLE';
  readonly date: Date;
  readonly montantDu: number;
  readonly moisEnRetard: number;
};

export function lignesEcheancierInppOnem(
  mois: readonly MoisDuRegistre[],
  prochaineOnem: Date,
  prochaineInpp: Date,
): LigneEcheancierInppOnem[] {
  const ligne = (
    part: 'ONEM' | 'INPP',
    periodicite: 'MENSUELLE' | 'TRIMESTRIELLE',
    date: Date,
    dela: (m: MoisDuRegistre) => boolean,
  ): LigneEcheancierInppOnem => {
    const siennes = mois.filter((m) => dela(m) && m.echeance.getTime() <= date.getTime());
    return {
      part,
      periodicite,
      date,
      montantDu: centimes(siennes.reduce((s, m) => s + m.solde, 0)),
      moisEnRetard: new Set(siennes.filter((m) => m.enRetard).map((m) => m.mois)).size,
    };
  };
  return [
    ligne('ONEM', 'MENSUELLE', prochaineOnem, (m) => m.part === 'ONEM'),
    ligne('INPP', 'TRIMESTRIELLE', prochaineInpp, (m) => m.part !== 'ONEM'),
  ];
}

/**
 * LE REVERSEMENT S'IMPUTE SUR LA DETTE ÉCHUE D'ABORD, LA PLUS ANCIENNE EN TÊTE
 * (relecture adverse, mineur c) · ordre emprunté au Code civil, Livre III,
 * art. 154 (« Lorsque la quittance ne porte aucune imputation, le payement
 * doit être imputé sur la dette que le débiteur avait pour lors le plus
 * d'intérêt d'acquitter entre celles qui sont pareillement échues, sinon sur
 * la dette échue, quoique moins onéreuse que celles qui ne le sont point. Si
 * les dettes sont d'égale nature, l'imputation se fait sur la plus
 * ancienne »). TROIS LIMITES, dites dans la réserve. (1) PAR ANALOGIE ·
 * l'art. 154 règle les dettes d'un débiteur envers UN créancier ; l'INPP et
 * l'ONEM sont deux organismes, et le versement réel va à l'un ou à l'autre ·
 * c'est son bordereau qui le dit, que le 4428 ne porte pas. (2) « La plus
 * ancienne » se lit à l'ÉCHÉANCE (l'ONEM de février, dû le 15 mars, avant
 * l'INPP de janvier, dû le 30 avril) ; lue à la naissance de la dette, une
 * fois les deux échues, l'INPP de janvier passerait avant. (3) Ni la
 * déclaration du débiteur (art. 151) ni l'intérêt qu'il avait à acquitter
 * l'une plutôt que l'autre (premier critère de l'art. 154) ne sont lus.
 */
export const RESERVE_IMPUTATION_INPP_ONEM =
  "Un reversement au 4428 ne dit pas s'il acquitte l'INPP ou l'ONEM. Le registre l'impute d'abord sur la dette échue, en commençant par l'échéance la plus ancienne, puis sur celles qui échoient ensuite · ordre emprunté par analogie au Code civil, Livre III, art. 154, qui vise les dettes envers un même créancier, alors que l'INPP et l'ONEM sont deux organismes. Le registre ne lit ni le bordereau qui dit à qui le versement est allé, ni l'intérêt que vous aviez à acquitter l'une plutôt que l'autre ; il lit l'ancienneté à l'échéance, et non à la naissance de la dette. Si votre versement visait une autre dette, la répartition affichée n'est pas la vôtre.";

/** Ce que le registre dit des montants qu'il n'a pas pu ventiler. */
export function mentionNonVentilee(montantFc: number): string | null {
  if (Math.abs(montantFc) < 0.005) return null;
  return (
    `INPP ET ONEM NON VENTILÉS · ${montantFc.toFixed(2)} FC portés à la dette de l'INPP et de l'ONEM ne se partagent pas entre les deux · leur écriture ne porte ni la charge de l'INPP (6415) ni celle de l'ONEM (6413). ` +
    "Ils sont datés à l'échéance trimestrielle de l'INPP, la plus tardive des deux, et aucun retard n'est affirmé avant elle. Passez la charge dans la même écriture pour que l'ONEM soit daté au 15 du mois suivant."
  );
}

/**
 * Art. 4 · la majoration de retard. DITE, jamais calculée · son montant est
 * celui que l'INPP réclame, sur la cotisation qu'il retient, et le registre
 * ne connaît ni la date du versement réel ni la part de chaque mois que le
 * payeur visait (voir l'imputation des reversements, `retenues.service.ts`).
 * Même parti que les majorations de la CNSS et de l'ONEM.
 */
export const MAJORATION_RETARD_INPP =
  "MAJORATION DE RETARD · l'employeur qui ne verse pas aux échéances verse, en même temps que la cotisation, « une majoration du montant de celle-ci égale à 0,5 pour mille par jour de retard », à partir de la date où la cotisation devait être versée (ordonnance n° 84/186, art. 4). Le montant est un acte de l'INPP · ce registre ne le chiffre pas.";

/** Art. 6 et 7 · la taxation d'office et l'exécution forcée, actes de l'INPP, dits. */
export const TAXATION_D_OFFICE_INPP =
  "TAXATION D'OFFICE · l'employeur qui ne produit pas la déclaration des rémunérations s'expose, après mise en demeure, à une taxation d'office calculée sur le salaire minimum légal le plus élevé (ordonnance n° 84/186, art. 6) ; à défaut de paiement, à une exécution forcée après une mise en demeure restée sans suite pendant trente jours (art. 7). Actes de l'INPP, jamais calculés ici.";

/**
 * Art. 1er, al. 2 · LA RÉDUCTION DU TAUX. « Toutefois, dans le cas où
 * l'employeur assure lui-même la formation de son personnel, le département
 * du Travail et de la Prévoyance sociale peut accorder une réduction du taux
 * de cette cotisation [...]. En aucun cas, la réduction accordée ne pourra
 * être supérieure au quart du taux de la cotisation. »
 *
 * C'est un ACTE du ministère, sur avis de la délégation syndicale et avis
 * technique de l'INPP · elle se DÉCLARE avec sa référence, jamais présumée
 * (comme la majoration des risques professionnels, décision de la Caisse).
 * Elle s'exprime en POINTS du taux (3,5 % réduit de 0,5 point donne 3 %),
 * bornée au quart du taux du barème applicable au mois, qui dépend de la
 * nature, de l'effectif et du jour du versement · la borne se juge donc au
 * calcul, pas à la saisie.
 */
export const FRACTION_MAXIMALE_REDUCTION_INPP = 0.25;

export function motifRefusReductionInpp(tauxPourCent: number, reductionPoints: number): string | null {
  if (!Number.isFinite(reductionPoints) || reductionPoints <= 0) {
    return 'La réduction du taux INPP déclarée doit être un nombre de points strictement positif.';
  }
  const plafond = tauxPourCent * FRACTION_MAXIMALE_REDUCTION_INPP;
  // Comparaison au millième de point · une saisie de 0,875 sur 3,5 % est au
  // plafond exact, pas au-delà.
  if (reductionPoints - plafond > 1e-9) {
    return (
      `La réduction du taux INPP déclarée (${reductionPoints} point(s)) dépasse le quart du taux applicable (${tauxPourCent} %, soit ${centimes(plafond * 1000) / 1000} point(s) au plus) · ` +
      "« en aucun cas, la réduction accordée ne pourra être supérieure au quart du taux de la cotisation » (ordonnance n° 84/186, art. 1er, al. 2). Vérifiez l'acte qui l'accorde."
    );
  }
  return null;
}

export const reserveReductionInpp = (reductionPoints: number, reference: string, tauxBareme: number) =>
  `RÉDUCTION DÉCLARÉE · taux du barème ${tauxBareme} %, réduit de ${reductionPoints} point(s) par l'acte « ${reference} » (ordonnance n° 84/186, art. 1er, al. 2 · employeur qui assure lui-même la formation de son personnel, réduction au plus du quart du taux).`;
