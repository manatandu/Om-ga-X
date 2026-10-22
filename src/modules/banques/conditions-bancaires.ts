import { Referentiel } from '@prisma/client';

/**
 * CONDITIONS BANCAIRES, AUTORISATIONS DE FINANCEMENT, UNIONS DE COMPTES
 * (ligne sage-l3, fonction 46 · Sage 100, Structure des fichiers, tables
 * F_EBANQUECOND, F_AUTORISATIONFINBQ, F_UNION et F_EUNION, pp. 197 à 200,
 * 534 et 535 ; décision D15, architecture.md). Règles pures, sans base.
 *
 * TROIS DÉCLARATIONS, AUCUNE PRÉSOMPTION. Aucun texte ne fixe les conditions
 * d'un compte bancaire · c'est la convention signée avec la banque qui les
 * porte, et OmegaX la RECOPIE avec sa référence et sa date, jamais une valeur
 * par défaut. Les conditions ne calculent AUCUN agio · le relevé importé ne
 * porte que la date d'opération, la banque compte en dates de valeur, et une
 * échelle d'intérêts sur les dates comptables rendrait un montant différent
 * du sien, qu'on prendrait pour une erreur (CLAUDE.md § 10 bis, « le contrôle
 * qui fabrique une anomalie »). L'échelle reste au suivi.
 *
 * L'AUTORISATION EST UN ENGAGEMENT DE LA BANQUE, PAS UNE DETTE · AUDCIF,
 * fiche du compte 56, exclusions (« Les découverts bancaires autorisés, tant
 * qu'ils n'ont qu'un caractère d'engagement de la banque vis-à-vis de
 * l'entité et qu'ils s'ajustent donc sur le montant du solde débiteur chez le
 * banquier → comptes d'engagements hors bilan ») ; même exclusion dans la
 * fiche du compte 56 du SYCEBNL. Classe 9 de l'AUDCIF · « L'usage de la
 * classe 9 est facultatif », et les engagements hors bilan « doivent faire
 * obligatoirement l'objet d'une convention écrite » · la convention est donc
 * exigée, et l'inscription hors bilan PROPOSÉE, jamais passée.
 *
 * L'UNION NE COMPENSE RIEN AU BILAN · fiche du compte 52 des deux plans, les
 * comptes créditeurs « sont inscrits au passif du bilan sous le poste
 * "banques, découverts", sans compensation possible avec ceux des comptes
 * bancaires présentant un solde débiteur ». L'union est une VUE de
 * trésorerie (la position d'un groupe de comptes de la même banque, la fusion
 * d'échelles de la convention), jamais un poste.
 */

export const PERIODICITES_FRAIS = ['MENSUELLE', 'TRIMESTRIELLE', 'ANNUELLE'] as const;
export type PeriodiciteFrais = (typeof PERIODICITES_FRAIS)[number];

/** Le découvert à paliers · par intervalle (chaque tranche à son taux) ou par seuil (le taux du palier atteint vaut pour tout). */
export const TYPES_PALIER = ['INTERVALLE', 'SEUIL'] as const;
export type TypePalier = (typeof TYPES_PALIER)[number];

/** Trois paliers au plus, comme la convention que Sage décrit (EB_CondDecouvert, plafonds 01 à 03). */
export const PALIERS_MAX = 3;

export interface PalierDecouvert {
  /** Montant jusqu'auquel le taux s'applique, dans la monnaie du compte. */
  plafond: number;
  /** Taux annuel en pour cent. */
  taux: number;
}

export interface ConditionsSaisies {
  dateEffet: string;
  typePalier?: TypePalier | null;
  paliers?: PalierDecouvert[];
  tauxInteretsCrediteurs?: number | null;
  tauxCommissionMouvement?: number | null;
  tauxCommissionPlusFortDecouvert?: number | null;
  fraisTenueCompte?: number | null;
  periodiciteFrais?: PeriodiciteFrais | null;
  baseCalcul?: number | null;
  referenceConvention: string;
  dateConvention: string;
}

const estUnJour = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00.000Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
};

/** Un taux annuel en pour cent · de zéro à cent, six décimales au plus (un taux de référence se cote au millionième). */
function motifTaux(v: number | null | undefined, nom: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) return `${nom} · un taux annuel en pour cent, de 0 à 100.`;
  if (Math.round(v * 1e6) / 1e6 !== v) return `${nom} · six décimales au plus.`;
  return null;
}

/**
 * Le plus grand montant que la colonne garde (`Decimal(18,2)` · seize chiffres
 * avant la virgule). Au-delà, la base refusait l'écriture d'une erreur
 * anonyme · le refus se nomme ici (premier tour, constat m3).
 */
export const MONTANT_MAX = 9_999_999_999_999_999.99;

/** Un montant · positif ou nul, au centime, sous la borne de la colonne. */
function motifMontant(v: number | null | undefined, nom: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return `${nom} · un montant positif ou nul.`;
  if (v > MONTANT_MAX) return `${nom} · au-delà du plus grand montant qu'OmegaX tient.`;
  if (Math.round(v * 100) / 100 !== v) return `${nom} · au centime.`;
  return null;
}

/** La référence de la convention et sa date, exigées · rien ne se déclare sans la pièce qui le porte (classe 9, « convention écrite »). */
function motifConvention(reference: unknown, date: unknown): string | null {
  if (typeof reference !== 'string' || reference.trim().length === 0) return 'La référence de la convention signée avec la banque est exigée.';
  if ([...reference.trim()].length > 100) return 'La référence de la convention · cent caractères au plus.';
  if (!estUnJour(date)) return 'La date de la convention doit être un jour (AAAA-MM-JJ).';
  return null;
}

/** Le refus d'une déclaration de conditions, nommé · ou rien. */
export function motifRefusConditions(c: ConditionsSaisies): string | null {
  if (!estUnJour(c.dateEffet)) return "La date d'effet des conditions doit être un jour (AAAA-MM-JJ).";
  const convention = motifConvention(c.referenceConvention, c.dateConvention);
  if (convention) return convention;
  // LA FORME D'ABORD (premier tour, constats M2 et M4) · le DTO ne fait que
  // laisser passer ces champs, et une chaîne, un objet ou un palier `null`
  // tombaient en erreur 500 au premier `.entries()` ; un type inconnu
  // s'enregistrait et s'affichait « par intervalle ».
  if (c.typePalier != null && !TYPES_PALIER.includes(c.typePalier)) return 'Type de palier · par intervalle ou par seuil.';
  if (c.paliers != null && (!Array.isArray(c.paliers) || c.paliers.some((p) => typeof p !== 'object' || p === null))) {
    return 'Les paliers du découvert · une liste de plafonds et de taux.';
  }
  const paliers = c.paliers ?? [];
  if (paliers.length > PALIERS_MAX) return `Le découvert porte ${PALIERS_MAX} paliers au plus.`;
  if (paliers.length > 0 && !c.typePalier) return 'Le découvert à paliers dit s’ils jouent par intervalle ou par seuil.';
  if (paliers.length === 0 && c.typePalier) return 'Un type de palier sans palier · déclarez au moins un palier, ou retirez le type.';
  let precedent = 0;
  for (const [i, p] of paliers.entries()) {
    // Un plafond absent est une faute du palier, jamais « les plafonds ne
    // montent pas » (premier tour, m1) · `null <= 0` le faisait dire.
    if (typeof p.plafond !== 'number') return `Palier ${i + 1} · le plafond est exigé.`;
    if (typeof p.taux !== 'number') return `Palier ${i + 1} · le taux est exigé.`;
    const motifPlafond = motifMontant(p.plafond, `Palier ${i + 1}, plafond`);
    if (motifPlafond) return motifPlafond;
    if (p.plafond <= precedent) return `Palier ${i + 1} · les plafonds montent strictement d'un palier au suivant.`;
    precedent = p.plafond;
    const motif = motifTaux(p.taux, `Palier ${i + 1}, taux`);
    if (motif) return motif;
  }
  for (const [v, nom] of [
    [c.tauxInteretsCrediteurs, 'Taux des intérêts créditeurs'],
    [c.tauxCommissionMouvement, 'Taux de la commission de mouvement'],
    [c.tauxCommissionPlusFortDecouvert, 'Taux de la commission du plus fort découvert'],
  ] as const) {
    const motif = motifTaux(v, nom);
    if (motif) return motif;
  }
  const frais = motifMontant(c.fraisTenueCompte, 'Frais de tenue de compte');
  if (frais) return frais;
  if (c.fraisTenueCompte != null && !c.periodiciteFrais) return 'Les frais de tenue de compte disent leur périodicité (mensuelle, trimestrielle, annuelle).';
  if (c.periodiciteFrais && !PERIODICITES_FRAIS.includes(c.periodiciteFrais)) return 'Périodicité des frais · mensuelle, trimestrielle ou annuelle.';
  if (c.periodiciteFrais && c.fraisTenueCompte == null) return 'Une périodicité sans frais de tenue de compte · déclarez le montant, ou retirez la périodicité.';
  if (c.baseCalcul != null && c.baseCalcul !== 360 && c.baseCalcul !== 365) return 'La base de calcul des intérêts est de 360 ou de 365 jours.';
  return null;
}

/**
 * LES CONDITIONS EN VIGUEUR À UNE DATE · la version dont la date d'effet est
 * la plus tardive sans dépasser la date, ou rien (aucune ne se présume).
 */
export function conditionsEnVigueur<T extends { dateEffet: Date }>(versions: readonly T[], date: Date): T | null {
  let retenue: T | null = null;
  for (const v of versions) {
    if (v.dateEffet.getTime() > date.getTime()) continue;
    if (retenue === null || v.dateEffet.getTime() > retenue.dateEffet.getTime()) retenue = v;
  }
  return retenue;
}

// ---- Autorisations de financement -------------------------------------

export const NATURES_AUTORISATION = ['DECOUVERT', 'FACILITE_CAISSE', 'CREDIT_TRESORERIE', 'ESCOMPTE', 'AUTRE'] as const;
export type NatureAutorisation = (typeof NATURES_AUTORISATION)[number];

export const LIBELLE_NATURE_AUTORISATION: Record<NatureAutorisation, string> = {
  DECOUVERT: 'Découvert autorisé',
  FACILITE_CAISSE: 'Facilité de caisse',
  CREDIT_TRESORERIE: 'Crédit de trésorerie',
  ESCOMPTE: "Ligne d'escompte",
  AUTRE: 'Autre financement',
};

/**
 * L'utilisation se lit-elle sur le compte bancaire lui-même ? Le découvert et
 * la facilité de caisse « s'ajustent sur le montant du solde débiteur chez le
 * banquier » (fiche du compte 56, exclusions) · leur utilisation est le solde
 * CRÉDITEUR du compte du RIB dans les livres. Un crédit de trésorerie se tire
 * au 561, une ligne d'escompte au 565 (même fiche) · leur utilisation se lit
 * sur les opérations de financement (fonction 47), jamais deviné ici.
 */
export function seLitSurLeCompteBancaire(nature: NatureAutorisation): boolean {
  return nature === 'DECOUVERT' || nature === 'FACILITE_CAISSE';
}

export interface AutorisationSaisie {
  nature: NatureAutorisation;
  montant: number;
  dateDebut: string;
  dateFin?: string | null;
  irrevocable: boolean;
  referenceConvention: string;
  dateConvention: string;
}

export function motifRefusAutorisation(a: AutorisationSaisie): string | null {
  if (!NATURES_AUTORISATION.includes(a.nature)) return "Nature de l'autorisation · découvert, facilité de caisse, crédit de trésorerie, escompte ou autre.";
  if (typeof a.montant !== 'number' || !Number.isFinite(a.montant)) return 'Le montant autorisé est exigé, en chiffres.';
  if (a.montant <= 0) return 'Le montant autorisé est strictement positif.';
  if (a.montant > MONTANT_MAX) return "Le montant autorisé · au-delà du plus grand montant qu'OmegaX tient.";
  if (Math.round(a.montant * 100) / 100 !== a.montant) return 'Le montant autorisé · au centime.';
  if (!estUnJour(a.dateDebut)) return "La date de début de l'autorisation doit être un jour (AAAA-MM-JJ).";
  if (a.dateFin != null && a.dateFin !== '') {
    if (!estUnJour(a.dateFin)) return "La date de fin de l'autorisation doit être un jour (AAAA-MM-JJ).";
    if (a.dateFin < a.dateDebut) return "La date de fin de l'autorisation précède sa date de début.";
  }
  if (typeof a.irrevocable !== 'boolean') return "L'autorisation dit si la banque s'est engagée de façon irrévocable.";
  return motifConvention(a.referenceConvention, a.dateConvention);
}

/** L'autorisation court-elle à cette date ? Début inclus, fin incluse, sans fin elle court. */
export function autorisationEnCours(a: { dateDebut: Date; dateFin: Date | null }, date: Date): boolean {
  return a.dateDebut.getTime() <= date.getTime() && (a.dateFin === null || a.dateFin.getTime() >= date.getTime());
}

export interface SituationAutorisation {
  /** Le montant utilisé · `null` quand il ne se lit pas sur le compte bancaire, ou que le solde n'est pas lu. */
  utilise: number | null;
  nonUtilise: number | null;
  depassement: number | null;
}

/**
 * LA SITUATION D'UNE AUTORISATION · `soldeDuCompte` est le solde du compte
 * bancaire VU DE L'ENTITÉ (débit moins crédit) dans la monnaie de
 * l'autorisation, `null` s'il n'est pas lu. Un solde débiteur n'utilise rien ;
 * un solde créditeur est le découvert utilisé. Le dépassement se DIT, il ne
 * se refuse pas · la banque seule juge de sa convention.
 */
export function situationAutorisation(a: { nature: NatureAutorisation; montant: number }, soldeDuCompte: number | null): SituationAutorisation {
  if (!seLitSurLeCompteBancaire(a.nature) || soldeDuCompte === null) return { utilise: null, nonUtilise: null, depassement: null };
  const centimes = (x: number) => Math.round(x * 100);
  const utilise = Math.max(0, -centimes(soldeDuCompte));
  const autorise = centimes(a.montant);
  return {
    utilise: utilise / 100,
    nonUtilise: Math.max(0, autorise - utilise) / 100,
    depassement: Math.max(0, utilise - autorise) / 100,
  };
}

/**
 * PLUSIEURS AUTORISATIONS SUR LE MÊME SOLDE (premier tour, constat M4 des
 * trois relecteurs) · un découvert de 1 000 000 et une facilité de 500 000
 * en cours sur le même compte, créditeur de 1 200 000 · confrontée SEULE au
 * solde entier, chacune rendait 1 200 000 utilisés et un dépassement
 * (200 000 et 700 000), en rouge, quand l'enveloppe de 1 500 000 n'était pas
 * dépassée. C'est le contrôle qui fabrique une anomalie (CLAUDE.md § 10 bis).
 * Le solde se confronte donc au TOTAL de ce qui se lit sur lui, une ligne
 * par RIB ; chacune des autorisations dit pourquoi elle n'a pas la sienne.
 * Aucune n'est imputée avant l'autre · aucun texte ne dit l'ordre où une
 * banque tire ses lignes.
 */
export const MOTIF_SITUATION_SUR_LE_TOTAL =
  'Plusieurs autorisations en cours se lisent sur le même compte · leur situation est donnée sur leur total, à la ligne du RIB.';

export function situationSurLeTotal(montants: readonly number[], soldeDuCompte: number | null): SituationAutorisation & { autorise: number } {
  const autorise = Math.round(montants.reduce((s, m) => s + Math.round(m * 100), 0)) / 100;
  return { autorise, ...situationAutorisation({ nature: 'DECOUVERT', montant: autorise }, soldeDuCompte) };
}

export interface InscriptionHorsBilan {
  debit: string;
  credit: string;
  /** Pourquoi ce compte · la fiche qui le dit. */
  fondement: string;
}

/**
 * L'INSCRIPTION HORS BILAN, PROPOSÉE · au SYSCOHADA, la part non utilisée
 * d'un engagement de financement obtenu. 9011 « Crédits confirmés obtenus »
 * quand la banque s'est engagée « d'une façon irrévocable » (fiche du compte
 * 9011, « la partie non utilisée des crédits qu'une banque s'est engagée,
 * d'une façon irrévocable, à accorder à l'entité »), contrepartie 9111 ;
 * sinon 9018 « Autres engagements de financement obtenus », contrepartie
 * 9118 (fiche des comptes 9013, 9014 et 9018 · « la part non utilisée de ces
 * engagements »). Au SYCEBNL, UN NUMÉRO, DEUX SENS · sa classe 9 porte les
 * contributions volontaires en nature (90 et 91 « Emplois » et
 * « Contributions volontaires en nature »), aucun compte d'engagement · rien
 * n'est proposé, et c'est dit.
 */
export function inscriptionHorsBilan(referentiel: Referentiel, irrevocable: boolean): InscriptionHorsBilan | null {
  if (referentiel !== Referentiel.SYSCOHADA) return null;
  return irrevocable
    ? { debit: '90110000', credit: '91110000', fondement: 'AUDCIF, fiche du compte 9011 · crédit que la banque s’est engagée, de façon irrévocable, à accorder' }
    : { debit: '90180000', credit: '91180000', fondement: 'AUDCIF, fiche des comptes 9013, 9014 et 9018 · autre engagement de financement obtenu' };
}

export const MOTIF_SANS_HORS_BILAN_SYCEBNL =
  "Le plan du SYCEBNL n'ouvre aucun compte d'engagement hors bilan · sa classe 9 porte les contributions volontaires en nature. L'engagement de la banque se décrit aux notes annexes.";

// ---- Unions de comptes -------------------------------------------------

/** La monnaie d'un RIB, lue comme la monnaie d'un ordre de virement · sans devise ou « CDF », le franc (`null`). */
export function monnaieDuRib(devise: string | null | undefined): string | null {
  const d = (devise ?? '').trim().toUpperCase();
  return d === '' || d === 'CDF' ? null : d;
}

export interface UnionSaisie {
  code: string;
  intitule: string;
  ribIds: string[];
}

/** Le code d'une union · lettres et chiffres en majuscules, dix au plus (Sage, UN_Abrege, sept). */
export function normaliserCodeUnion(code: string): string {
  return code.trim().toUpperCase();
}

/** Une union réunit au plus autant de comptes que la liste des RIB en sert (`LIMITE_RIBS` du service). */
export const MEMBRES_MAX_UNION = 200;

/**
 * LA FORME D'UNE UNION, jugée AVANT toute lecture de la base (premier tour,
 * constat M3) · des identifiants qui ne sont pas des chaînes tombaient en
 * erreur 500 dans la requête, une chaîne seule était éclatée en caractères,
 * et au-delà de la borne de lecture des RIB du dossier se disaient
 * « introuvables ».
 */
export function motifFormeUnion(u: UnionSaisie): string | null {
  const code = normaliserCodeUnion(typeof u.code === 'string' ? u.code : '');
  if (!/^[A-Z0-9]{1,10}$/.test(code)) return "Le code de l'union · lettres et chiffres, dix au plus.";
  const intitule = (typeof u.intitule === 'string' ? u.intitule : '').trim();
  if (intitule.length === 0 || [...intitule].length > 60) return "L'intitulé de l'union · de un à soixante caractères.";
  if (!Array.isArray(u.ribIds) || u.ribIds.some((id) => typeof id !== 'string' || id.length === 0)) return "Les comptes de l'union · une liste de RIB.";
  if (u.ribIds.length > MEMBRES_MAX_UNION) return `Une union réunit ${MEMBRES_MAX_UNION} comptes au plus.`;
  const ids = new Set(u.ribIds);
  if (ids.size < 2) return 'Une union réunit au moins deux comptes bancaires.';
  if (ids.size !== u.ribIds.length) return 'Un même RIB figure deux fois dans l’union.';
  return null;
}

export interface RibDUnion {
  id: string;
  abrege: string;
  devise: string | null;
  /** Le compte de trésorerie du journal du RIB · deux RIB sur le même compte compteraient deux fois son solde. */
  compteId?: string | null;
  /** Le compte est tenu en devise (racine du plan ou ligne en devise) sans que le RIB le dise. */
  compteEnDevise?: boolean;
}

export function motifRefusUnion(u: UnionSaisie, ribs: readonly RibDUnion[]): string | null {
  const forme = motifFormeUnion(u);
  if (forme) return forme;
  const ids = [...new Set(u.ribIds)];
  if (ids.some((id) => !ribs.some((r) => r.id === id))) return "Un des RIB choisis est introuvable dans ce dossier · relisez la liste.";
  const membres = ids.map((id) => ribs.find((r) => r.id === id)!);
  // UN COMPTE EN DEVISE SE DIT AU RIB (premier tour, M3) · sans quoi sa
  // contrevaleur en francs s'additionnait à un vrai compte en francs.
  const muet = membres.find((r) => r.compteEnDevise && monnaieDuRib(r.devise) === null);
  if (muet) return `Le compte du RIB ${muet.abrege} est tenu en devise, et le RIB ne dit pas laquelle · renseignez sa devise (Structure › Paramètres de saisie › Banques).`;
  // UN COMPTE, UNE FOIS (premier tour, M4) · deux journaux d'un dossier hérité
  // peuvent tenir le même compte, et la position l'aurait compté deux fois.
  const vus = new Map<string, string>();
  for (const r of membres) {
    if (!r.compteId) continue;
    const deja = vus.get(r.compteId);
    if (deja) return `Les RIB ${deja} et ${r.abrege} lisent le même compte comptable · une union ne compte un compte qu'une fois.`;
    vus.set(r.compteId, r.abrege);
  }
  // UNE MONNAIE PAR UNION (Sage, F_UNION.N_Devise, unique) · additionner des
  // francs et des dollars donnerait une position sans unité.
  const monnaies = new Set(ids.map((id) => monnaieDuRib(ribs.find((r) => r.id === id)!.devise)));
  if (monnaies.size > 1) {
    const noms = ids.map((id) => ribs.find((r) => r.id === id)!).map((r) => `${r.abrege} (${monnaieDuRib(r.devise) ?? 'CDF'})`).join(', ');
    return `Une union réunit des comptes d'une même monnaie · ${noms}.`;
  }
  return null;
}

export interface PositionUnion {
  total: number | null;
  /** Les comptes dont le solde n'a pas pu se lire · le total est alors `null`, jamais partiel. */
  nonLus: string[];
  /** Pourquoi le total n'est pas servi, quand ce n'est pas un solde manquant. */
  motif: string | null;
}

/**
 * La position d'une union · la somme des soldes de ses comptes, ou rien si un
 * solde manque (un total partiel passerait pour la position), ou si deux
 * membres lisent le même compte (une union créée avant la règle, premier
 * tour M4 · le solde aurait compté deux fois).
 */
export function positionUnion(soldes: readonly { abrege: string; solde: number | null; compteId?: string | null }[]): PositionUnion {
  const nonLus = soldes.filter((s) => s.solde === null).map((s) => s.abrege);
  if (nonLus.length > 0) return { total: null, nonLus, motif: null };
  const comptes = soldes.map((s) => s.compteId).filter((c): c is string => typeof c === 'string');
  if (new Set(comptes).size !== comptes.length) {
    return { total: null, nonLus: [], motif: "Deux comptes de l'union lisent le même compte comptable · la position le compterait deux fois." };
  }
  return { total: Math.round(soldes.reduce((s, x) => s + Math.round((x.solde as number) * 100), 0)) / 100, nonLus: [], motif: null };
}
