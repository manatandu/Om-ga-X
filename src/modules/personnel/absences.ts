/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 1 · LES ABSENCES DU SALARIÉ ET CE QUE LE
 * TEXTE EN FAIT (décision D8, `docs/comparaison-sage/reproduction/
 * architecture.md`). Moteur pur · aucune lecture en base.
 *
 * CHAQUE NATURE PORTE SON TEXTE, ET RIEN D'AUTRE.
 *
 *  · Code du travail, art. 57 · les huit causes de suspension du contrat
 *    (« l'incapacité de travail résultant d'une maladie ou d'un accident, de
 *    la grossesse ou de l'accouchement et de ses suites », obligations
 *    militaires, réquisition, mandats publics, mise à pied « jusqu'à
 *    concurrence de deux fois quinze jours par an », grève ou lock-out,
 *    incarcération, force majeure « constaté[e] par l'Inspecteur du
 *    Travail »).
 *  · Art. 58 · un arrêté du Ministre « fixe les droits et obligations des
 *    parties dans chacun des cas de suspension prévus à l'article précédent,
 *    points 2 à 7 ». Cet arrêté N'EST PAS AU CORPUS · pour ces causes, rien
 *    n'est proposé au bulletin, et c'est dit (`ARRETE_ABSENT`).
 *  · Art. 59 · « En dehors des obligations prévues aux articles 105, 106,
 *    130, 146 à 156 et 178 [...] et de celles découlant [de l'arrêté de
 *    l'art. 58], les parties sont déliées de toute obligation l'une envers
 *    l'autre pendant toute la durée de la suspension du contrat. » La force
 *    majeure (point 8), hors de l'art. 58, ne doit donc rien (`NON_DUE`).
 *  · Art. 105 · maladie ou accident · « les deux tiers de la rémunération en
 *    espèces et [...] la totalité des allocations familiales », « dans les
 *    conditions fixées à l'article 66 » (moyenne des douze mois des
 *    commissions, primes, gratifications et participations).
 *  · Art. 106 · accident du travail ou maladie professionnelle · les deux
 *    tiers « pendant les six premiers mois de la suspension du contrat ».
 *  · Art. 130 · maternité · quatorze semaines consécutives, « les deux tiers
 *    de sa rémunération ».
 *  · Art. 146 · congés de circonstance, nombre de jours par événement, « ne
 *    peuvent être fractionnés », payés par l'employeur « jusqu'à concurrence
 *    de quinze jours ouvrables par an ».
 *  · Art. 93 · « La rémunération est due pour le temps où le travailleur a
 *    effectivement fourni ses services ; elle est également due lorsque le
 *    travailleur a été mis dans l'impossibilité de travailler du fait de
 *    l'employeur ainsi que pour les jours fériés légaux » · l'absence non
 *    autorisée n'est pas payée, l'empêchement du fait de l'employeur l'est.
 *
 * LES JOURS · une absence se compte en jours OUVRABLES du Code (art. 7,
 * point 9 ; `jours-du-code-du-travail.ts`), une demi-journée au premier ou au
 * dernier jour retranchant une moitié. Les jours fériés compris dans une
 * absence restent payés à plein (art. 93) · ils ne sont ni retenus ni payés
 * aux deux tiers, lecture protectrice dite à l'écran.
 */
import { estJourOuvrableDuCode, estJourRemunere, natureDuJour } from './jours-du-code-du-travail';
import { JOURS_DU_MOIS_REMUNERES, plusMois } from './remuneration-du-delai';

export type JourIso = string;

export type NatureAbsence =
  | 'MALADIE_OU_ACCIDENT'
  | 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE'
  | 'MATERNITE'
  | 'CONGE_DE_CIRCONSTANCE'
  | 'EMPECHEMENT_DU_FAIT_DE_L_EMPLOYEUR'
  | 'ABSENCE_NON_AUTORISEE'
  | 'MISE_A_PIED'
  | 'OBLIGATIONS_MILITAIRES'
  | 'REQUISITION'
  | 'MANDAT_PUBLIC'
  | 'GREVE_OU_LOCK_OUT'
  | 'INCARCERATION'
  | 'FORCE_MAJEURE';

/** Ce que l'employeur doit pour les jours de l'absence. */
export type RegimeRemuneration =
  /** La rémunération reste due (art. 93, art. 146). */
  | 'DUE'
  /** Les deux tiers (art. 105, 106, 130). */
  | 'DEUX_TIERS'
  /** Rien n'est dû (art. 59, art. 93). */
  | 'NON_DUE'
  /** L'arrêté de l'art. 58 n'est pas au corpus · rien n'est tranché. */
  | 'ARRETE_ABSENT';

/** Ce que l'absence fait au compteur des congés (art. 141, al. 2). */
export type EffetSurLeConge =
  /** Un jour de service · prestation, congé payé, ou empêchement du fait de l'employeur. */
  | 'SERVICE'
  /** Incapacité · service dans la limite de six mois par année de service. */
  | 'INCAPACITE_PLAFONNEE'
  /** Accident du travail ou maladie professionnelle · service sans limite. */
  | 'INCAPACITE_SANS_PLAFOND'
  /** Hors service · le mois qui le contient n'est pas entier. */
  | 'HORS_SERVICE';

export type DefinitionAbsence = {
  readonly libelle: string;
  readonly fondement: string;
  readonly regime: RegimeRemuneration;
  readonly conge: EffetSurLeConge;
  /** Art. 141, al. 4 · « Les jours de maladie [...] ne sont pas comptés comme jours de congé. » */
  readonly maladie: boolean;
  /** La pièce que le texte suppose · exigée à la saisie, `null` quand aucune ne l'est. */
  readonly piece: string | null;
  /** Demi-journées admises · non pour ce que le texte compte en semaines ou interdit de fractionner. */
  readonly demiJournees: boolean;
};

export const NATURES_ABSENCE: Readonly<Record<NatureAbsence, DefinitionAbsence>> = {
  MALADIE_OU_ACCIDENT: {
    libelle: 'Maladie ou accident',
    fondement: 'Code du travail, art. 57, 1° ; art. 105',
    regime: 'DEUX_TIERS',
    conge: 'INCAPACITE_PLAFONNEE',
    maladie: true,
    piece: 'certificat médical',
    demiJournees: true,
  },
  ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE: {
    libelle: 'Accident du travail ou maladie professionnelle',
    fondement: 'Code du travail, art. 57, 1° ; art. 106',
    regime: 'DEUX_TIERS',
    conge: 'INCAPACITE_SANS_PLAFOND',
    maladie: true,
    piece: 'certificat médical',
    demiJournees: true,
  },
  MATERNITE: {
    libelle: 'Maternité',
    fondement: 'Code du travail, art. 57, 1° ; art. 130',
    regime: 'DEUX_TIERS',
    // L'art. 57, 1° range la grossesse et l'accouchement parmi les causes
    // d'« incapacité de travail » · la limite de six mois de l'art. 141,
    // al. 2 les compte donc avec la maladie.
    conge: 'INCAPACITE_PLAFONNEE',
    maladie: false,
    piece: 'certificat médical',
    demiJournees: false,
  },
  CONGE_DE_CIRCONSTANCE: {
    libelle: 'Congé de circonstance',
    fondement: 'Code du travail, art. 146',
    regime: 'DUE',
    conge: 'SERVICE',
    maladie: false,
    piece: null,
    demiJournees: false,
  },
  EMPECHEMENT_DU_FAIT_DE_L_EMPLOYEUR: {
    libelle: "Empêchement du fait de l'employeur",
    fondement: 'Code du travail, art. 93',
    regime: 'DUE',
    // Le travailleur se tenait à la disposition de l'employeur · lecture
    // protectrice, dite, de l'art. 141, al. 2.
    conge: 'SERVICE',
    maladie: false,
    piece: null,
    demiJournees: true,
  },
  ABSENCE_NON_AUTORISEE: {
    libelle: 'Absence non autorisée',
    fondement: 'Code du travail, art. 93',
    regime: 'NON_DUE',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: null,
    demiJournees: true,
  },
  MISE_A_PIED: {
    libelle: 'Mise à pied disciplinaire',
    fondement: 'Code du travail, art. 57, 5° ; art. 58',
    regime: 'ARRETE_ABSENT',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: 'décision de mise à pied',
    demiJournees: false,
  },
  OBLIGATIONS_MILITAIRES: {
    libelle: 'Obligations militaires',
    fondement: 'Code du travail, art. 57, 2° ; art. 58',
    regime: 'ARRETE_ABSENT',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: null,
    demiJournees: false,
  },
  REQUISITION: {
    libelle: 'Réquisition',
    fondement: 'Code du travail, art. 57, 3° ; art. 58',
    regime: 'ARRETE_ABSENT',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: null,
    demiJournees: false,
  },
  MANDAT_PUBLIC: {
    libelle: 'Mandat public ou obligation civique',
    fondement: 'Code du travail, art. 57, 4° ; art. 58',
    regime: 'ARRETE_ABSENT',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: null,
    demiJournees: true,
  },
  GREVE_OU_LOCK_OUT: {
    libelle: 'Grève ou lock-out',
    fondement: 'Code du travail, art. 57, 6° ; art. 58',
    regime: 'ARRETE_ABSENT',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: null,
    demiJournees: true,
  },
  INCARCERATION: {
    libelle: 'Incarcération',
    fondement: 'Code du travail, art. 57, 7° ; art. 58',
    regime: 'ARRETE_ABSENT',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: null,
    demiJournees: false,
  },
  FORCE_MAJEURE: {
    libelle: 'Force majeure',
    fondement: 'Code du travail, art. 57, 8° ; art. 59',
    regime: 'NON_DUE',
    conge: 'HORS_SERVICE',
    maladie: false,
    piece: "constat de l'Inspecteur du Travail",
    demiJournees: false,
  },
};

export const NATURES_ABSENCE_LISTE = Object.keys(NATURES_ABSENCE) as NatureAbsence[];

/** Art. 146 · les événements et leurs jours ouvrables, recopiés du texte. */
export const EVENEMENTS_CIRCONSTANCE = {
  MARIAGE_DU_TRAVAILLEUR: { libelle: 'Mariage du travailleur', jours: 2 },
  ACCOUCHEMENT_DE_L_EPOUSE: { libelle: "Accouchement de l'épouse", jours: 2 },
  DECES_CONJOINT_OU_PARENT_PREMIER_DEGRE: { libelle: "Décès du conjoint, ou d'un parent allié au 1er degré", jours: 4 },
  MARIAGE_D_UN_ENFANT: { libelle: "Mariage d'un enfant", jours: 1 },
  DECES_PARENT_SECOND_DEGRE: { libelle: "Décès d'un parent ou allié au second degré", jours: 2 },
} as const;
export type EvenementCirconstance = keyof typeof EVENEMENTS_CIRCONSTANCE;

/** Art. 146 · « L'employeur n'est tenu au paiement des congés de circonstance que jusqu'à concurrence de quinze jours ouvrables par an. » */
export const PLAFOND_CIRCONSTANCE_PAR_AN = 15;
/** Art. 57, 5° · « deux fois quinze jours par an » · lu comme deux mesures d'au plus quinze jours de calendrier. */
export const MISE_A_PIED_JOURS_AU_PLUS = 15;
export const MISES_A_PIED_PAR_AN = 2;
/** Art. 130 · « quatorze semaines consécutives ». */
export const MATERNITE_JOURS_AU_PLUS = 14 * 7;
/** La liste des fériés n'est au corpus qu'à partir de l'ordonnance n° 23-042 du 30 mars 2023. */
export const PREMIER_JOUR_LISIBLE = '2023-03-30';
/** Au-delà, l'absence se refuse plutôt que de tourner sans fin (dix ans). */
const JOURS_AU_PLUS = 3_660;

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
export const iso = (d: Date): JourIso => d.toISOString().slice(0, 10);
export function jourUtc(s: string): Date | null {
  const m = JOUR.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) || iso(d) !== s ? null : d;
}
const plusJours = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

export type AbsenceLue = {
  readonly id: string;
  readonly nature: NatureAbsence;
  readonly du: JourIso;
  readonly au: JourIso;
  readonly demiJourneeDebut: boolean;
  readonly demiJourneeFin: boolean;
};

/** Un jour de l'absence et son poids · une demi-journée pèse une moitié. */
export type JourDAbsence = { readonly jour: JourIso; readonly ouvrable: boolean; readonly poids: number };

/** Les jours d'une absence, bornés · ou le refus qui dit pourquoi elle ne se compte pas. */
export function joursDeLAbsence(a: Pick<AbsenceLue, 'du' | 'au' | 'demiJourneeDebut' | 'demiJourneeFin'>): JourDAbsence[] | { refus: string } {
  const du = jourUtc(a.du);
  const au = jourUtc(a.au);
  if (!du || !au) return { refus: "Les dates de l'absence se lisent AAAA-MM-JJ." };
  if (au.getTime() < du.getTime()) return { refus: "L'absence finit avant de commencer." };
  if (a.du < PREMIER_JOUR_LISIBLE) {
    return { refus: "L'absence commence avant le 30 mars 2023 · la liste des jours fériés antérieure à l'ordonnance n° 23-042 n'est pas au corpus." };
  }
  const jours: JourDAbsence[] = [];
  for (let i = 0, d = du; d.getTime() <= au.getTime(); i += 1, d = plusJours(du, i)) {
    if (i > JOURS_AU_PLUS) return { refus: "L'absence dépasse dix ans de calendrier · elle ne se compte pas." };
    const ouvrable = natureDuJour(d) === 'OUVRABLE';
    // Un seul jour marqué des deux côtés reste UNE demi-journée.
    const demi =
      a.du === a.au
        ? a.demiJourneeDebut || a.demiJourneeFin
        : (iso(d) === a.du && a.demiJourneeDebut) || (iso(d) === a.au && a.demiJourneeFin);
    jours.push({ jour: iso(d), ouvrable, poids: demi ? 0.5 : 1 });
  }
  return jours;
}

/** Les jours ouvrables d'une liste de jours · le décompte de Sage, au sens du Code. */
export const joursOuvrables = (jours: readonly JourDAbsence[]): number => jours.filter((j) => j.ouvrable).reduce((n, j) => n + j.poids, 0);

/**
 * LE MOTIF DE REFUS D'UNE ABSENCE, ou `null` · ce que le texte borne lui-même.
 * Les absences déjà enregistrées (`autres`, non annulées, du même salarié)
 * servent au chevauchement et aux plafonds annuels.
 */
export function motifRefusAbsence(
  a: AbsenceLue & { readonly evenement: string | null; readonly piece: string | null },
  autres: readonly AbsenceLue[],
): string | null {
  const def = NATURES_ABSENCE[a.nature];
  if (!def) return "Nature d'absence inconnue.";
  const jours = joursDeLAbsence(a);
  if ('refus' in jours) return jours.refus;
  if ((a.demiJourneeDebut || a.demiJourneeFin) && !def.demiJournees) {
    return `${def.libelle} · ne se compte pas en demi-journées (${def.fondement}).`;
  }
  if (def.piece && (a.piece ?? '').trim().length < 3) return `${def.libelle} · la pièce se déclare (${def.piece}).`;
  const chevauche = autres.find((x) => x.id !== a.id && x.du <= a.au && x.au >= a.du);
  if (chevauche) {
    return `L'absence chevauche celle du ${chevauche.du} au ${chevauche.au} (${NATURES_ABSENCE[chevauche.nature].libelle}) · une journée n'a qu'une cause.`;
  }
  if (a.nature === 'CONGE_DE_CIRCONSTANCE') {
    const ev = a.evenement ? EVENEMENTS_CIRCONSTANCE[a.evenement as EvenementCirconstance] : undefined;
    if (!ev) return "Congé de circonstance · l'événement se déclare (Code du travail, art. 146).";
    const n = joursOuvrables(jours);
    if (n > ev.jours) {
      return `Congé de circonstance · ${ev.libelle.toLowerCase()} ouvre ${ev.jours} jour(s) ouvrable(s), l'absence en compte ${n} (Code du travail, art. 146). Le surplus se déclare sous sa propre nature.`;
    }
  }
  if (a.nature === 'MISE_A_PIED') {
    if (jours.length > MISE_A_PIED_JOURS_AU_PLUS) {
      return `Mise à pied · ${jours.length} jours de calendrier ; le Code n'en fait une cause de suspension que « jusqu'à concurrence de deux fois quinze jours par an » (art. 57, 5°).`;
    }
    const memeAnnee = autres.filter((x) => x.id !== a.id && x.nature === 'MISE_A_PIED' && x.du.slice(0, 4) === a.du.slice(0, 4));
    if (memeAnnee.length >= MISES_A_PIED_PAR_AN) {
      return `Mise à pied · ${memeAnnee.length} mesure(s) déjà enregistrée(s) en ${a.du.slice(0, 4)} ; le Code n'en admet que deux de quinze jours par an (art. 57, 5°).`;
    }
  }
  if (a.nature === 'MATERNITE' && jours.length > MATERNITE_JOURS_AU_PLUS) {
    return `Maternité · ${jours.length} jours de calendrier ; la suspension est de « quatorze semaines consécutives » (Code du travail, art. 130).`;
  }
  return null;
}

/**
 * LES JOURS DE CIRCONSTANCE PAYÉS PAR L'EMPLOYEUR · les quinze premiers jours
 * ouvrables de l'année civile, dans l'ordre des dates (art. 146) · au-delà,
 * l'employeur n'y est pas tenu et le jour n'est pas dû.
 */
function joursDeCirconstanceNonDus(absences: readonly AbsenceLue[]): Set<JourIso> {
  const parAn = new Map<string, number>();
  const nonDus = new Set<JourIso>();
  const tries = absences.filter((a) => a.nature === 'CONGE_DE_CIRCONSTANCE').sort((x, y) => x.du.localeCompare(y.du));
  for (const a of tries) {
    const jours = joursDeLAbsence(a);
    if ('refus' in jours) continue;
    for (const j of jours) {
      if (!j.ouvrable) continue;
      const an = j.jour.slice(0, 4);
      const deja = parAn.get(an) ?? 0;
      if (deja + j.poids > PLAFOND_CIRCONSTANCE_PAR_AN) nonDus.add(j.jour);
      parAn.set(an, deja + j.poids);
    }
  }
  return nonDus;
}

/** Art. 106 · les deux tiers « pendant les six premiers mois de la suspension », comptés de date à date depuis son premier jour. */
export const finDesSixMois = (du: JourIso): JourIso => iso(plusMois(jourUtc(du) as Date, 6));

/**
 * LE PREMIER JOUR DE LA SUSPENSION qu'une fiche continue · M1 de la relecture
 * (premier tour). Un arrêt se renouvelle par fiches successives (un
 * certificat par période) ; les six mois de l'art. 106 (« les six premiers
 * mois de la suspension du contrat ») et de l'art. 60, a) (« six mois
 * ininterrompus d'incapacité ») courent du premier jour de la SUSPENSION,
 * jamais de chaque fiche · sans quoi un accident du travail renouvelé tous
 * les mois restait aux deux tiers sans fin, et la résiliation ouverte par
 * l'art. 60, a) ne se disait jamais.
 *
 * Deux fiches de MÊME nature font une seule suspension quand aucun jour
 * ouvrable du Code ne les sépare (art. 7, point 9 · seuls dimanches et jours
 * fériés entre elles, jours où le travailleur n'avait pas à reprendre) et
 * qu'aucune demi-journée ne marque la jointure (le travailleur a alors
 * travaillé une moitié du jour, la suspension s'est interrompue). Lecture
 * d'OmegaX, dite · le Code ne définit pas la contiguïté de deux certificats.
 */
export function debutsDesSuspensions(absences: readonly AbsenceLue[]): Map<string, JourIso> {
  const debuts = new Map<string, JourIso>();
  const parNature = new Map<NatureAbsence, AbsenceLue[]>();
  for (const a of absences) parNature.set(a.nature, [...(parNature.get(a.nature) ?? []), a]);
  for (const liste of parNature.values()) {
    const tries = [...liste].sort((x, y) => x.du.localeCompare(y.du) || x.au.localeCompare(y.au));
    let precedente: AbsenceLue | null = null;
    let debut: JourIso | null = null;
    for (const a of tries) {
      if (precedente && debut && seSuivent(precedente, a)) {
        debuts.set(a.id, debut);
        // La fiche qui finit le plus tard porte la jointure suivante.
        if (a.au > precedente.au) precedente = a;
      } else {
        debut = a.du;
        debuts.set(a.id, a.du);
        precedente = a;
      }
    }
  }
  return debuts;
}

/** Aucun jour ouvrable entre la fin de l'une et le début de l'autre, aucune demi-journée à la jointure. */
function seSuivent(avant: AbsenceLue, apres: AbsenceLue): boolean {
  if (avant.demiJourneeFin || apres.demiJourneeDebut) return false;
  if (apres.du <= avant.au) return true;
  const fin = jourUtc(avant.au);
  const debut = jourUtc(apres.du);
  if (!fin || !debut) return false;
  for (let i = 1, d = plusJours(fin, 1); d.getTime() < debut.getTime(); i += 1, d = plusJours(fin, i)) {
    if (i > 31 || estJourOuvrableDuCode(d)) return false;
  }
  return true;
}

/** Le régime d'UN jour d'une absence · le plafond de l'art. 146 et la limite de l'art. 106 jouent ici. */
function regimeDuJour(a: AbsenceLue, jour: JourIso, circonstanceNonDue: Set<JourIso>, debutSuspension: JourIso): RegimeRemuneration {
  const def = NATURES_ABSENCE[a.nature];
  if (a.nature === 'CONGE_DE_CIRCONSTANCE' && circonstanceNonDue.has(jour)) return 'NON_DUE';
  if (a.nature === 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE' && jour >= finDesSixMois(debutSuspension)) return 'NON_DUE';
  return def.regime;
}

export type JourDuMois = { readonly jour: JourIso; readonly absenceId: string; readonly nature: NatureAbsence; readonly poids: number; readonly regime: RegimeRemuneration };

/**
 * Les jours OUVRABLES d'absence qui tombent dans un mois `AAAA-MM`, avec leur
 * régime. Un arrêt sous SUBROGATION (étape 3) · l'employeur qui « continue à
 * payer la rémunération » (arrêté n° 146/2018, art. 139 et 146) paie ses
 * jours à plein, et reçoit l'indemnité de la Caisse.
 */
export function joursOuvrablesDuMois(absences: readonly AbsenceLue[], mois: string, subrogees: ReadonlySet<string> = new Set()): JourDuMois[] {
  const nonDus = joursDeCirconstanceNonDus(absences);
  const debuts = debutsDesSuspensions(absences);
  const sortie: JourDuMois[] = [];
  for (const a of absences) {
    if (a.au.slice(0, 7) < mois || a.du.slice(0, 7) > mois) continue;
    const jours = joursDeLAbsence(a);
    if ('refus' in jours) continue;
    for (const j of jours) {
      if (!j.ouvrable || j.jour.slice(0, 7) !== mois) continue;
      const regime = regimeDuJour(a, j.jour, nonDus, debuts.get(a.id) ?? a.du);
      sortie.push({ jour: j.jour, absenceId: a.id, nature: a.nature, poids: j.poids, regime: regime === 'DEUX_TIERS' && subrogees.has(a.id) ? 'DUE' : regime });
    }
  }
  return sortie;
}

/** Un congé payé lu pour la paie d'un mois · posé dans l'onglet Congés (fonction 79), non annulé. */
export type CongeLu = { readonly id: string; readonly du: JourIso; readonly au: JourIso; readonly joursVoyage: number };

export type CongeDuMois = {
  readonly id: string;
  readonly du: JourIso;
  readonly au: JourIso;
  /** Jours ouvrables du congé dans ce mois, jours de maladie retranchés (art. 141, al. 4). */
  readonly ouvrablesDuMois: number;
  /**
   * Jours de ce mois payés par l'allocation (livre de paie, mention 14) ·
   * `null` quand le congé est à cheval sur deux mois et porte des jours de
   * voyage, dont aucune date ne dit le mois.
   */
  readonly joursDeConge: number | null;
  /** Le moins que le congé paie dans ce mois · ce que l'émission oppose au salaire. */
  readonly auMoins: number;
};

/**
 * LES JOURS DE CONGÉ PAYÉ D'UN MOIS · B1 de la relecture (premier tour).
 * « Pendant toute la durée du congé, le travailleur a droit à une allocation
 * égale à la rémunération dont il jouit au moment du départ en congé »
 * (Code du travail, art. 142) · l'allocation REMPLACE le salaire de ces
 * jours, elle ne s'y ajoute pas. Le livre de paie les range dans deux
 * colonnes disjointes, jours payés à 100 % (mention 6) et jours de congés
 * payés (mention 14), qui s'additionnent aux jours payés aux deux tiers
 * (mention 17) dans le total des jours (mention 28 · arrêté
 * n° 12/CAB.MIN/ETPS/042 du 8 août 2008). Un même jour ne figure donc qu'une
 * fois.
 *
 * Jours comptés comme l'allocation les compte (`joursDuConge`) · ouvrables du
 * Code, maladie retranchée (art. 141, al. 4), jours de voyage hors du congé
 * (al. 3). Les jours de voyage restent au salaire · ni l'art. 141 ni l'art. 93
 * ne les retirent de la rémunération, lecture protectrice (P5). Un congé à
 * cheval sur deux mois compte dans chaque mois SES jours, quel que soit le
 * bulletin qui porte l'allocation (art. 145 · elle se paie avant le départ) ;
 * s'il porte des jours de voyage, leur mois n'est écrit nulle part · rien
 * n'est proposé, et l'émission n'oppose que ce qui est certain.
 */
export function congesDuMois(conges: readonly CongeLu[], mois: string, joursMaladie: ReadonlySet<JourIso>): CongeDuMois[] {
  const sortie: CongeDuMois[] = [];
  for (const c of conges) {
    if (c.au.slice(0, 7) < mois || c.du.slice(0, 7) > mois) continue;
    const du = jourUtc(c.du);
    const au = jourUtc(c.au);
    if (!du || !au || au.getTime() < du.getTime()) continue;
    let ouvrablesDuMois = 0;
    for (let i = 0, d = du; d.getTime() <= au.getTime() && i <= JOURS_AU_PLUS; i += 1, d = plusJours(du, i)) {
      if (iso(d).slice(0, 7) !== mois || !estJourOuvrableDuCode(d) || joursMaladie.has(iso(d))) continue;
      ouvrablesDuMois += 1;
    }
    const voyage = Math.max(0, c.joursVoyage);
    const aCheval = c.du.slice(0, 7) !== c.au.slice(0, 7);
    const auMoins = Math.max(0, ouvrablesDuMois - voyage);
    sortie.push({
      id: c.id,
      du: c.du,
      au: c.au,
      ouvrablesDuMois,
      joursDeConge: aCheval && voyage > 0 ? null : aCheval ? ouvrablesDuMois : auMoins,
      auMoins,
    });
  }
  return sortie;
}

/**
 * LE SALAIRE PLEIN PAYÉ AVEC L'ALLOCATION POUR LES MÊMES JOURS, refusé à
 * l'émission · B1 de la relecture. Le salaire du bulletin (éléments
 * « Salaire ou traitement ») ne paie au plus que les jours hors congé · le
 * salaire mensuel du contrat × (26 − jours de congé du mois) ÷ 26, vingt-six
 * jours payés par mois (décret n° 25/22, art. 7, par analogie, comme la
 * proposition des absences). N'est opposé que ce qui est certain · le moins
 * que le congé paie dans le mois, un salaire au mois du contrat, dans la
 * monnaie du bulletin. `null` quand rien ne s'oppose.
 */
export function motifRefusSalairePleinPendantLeConge(p: {
  readonly mois: string;
  readonly conges: readonly CongeDuMois[];
  readonly salaireDuBulletin: number;
  readonly salaireMensuel: number | null;
  readonly devise: string;
}): string | null {
  const auMoins = Math.min(JOURS_DU_MOIS_REMUNERES, p.conges.reduce((n, c) => n + c.auMoins, 0));
  if (auMoins <= 0 || p.salaireMensuel === null) return null;
  const plafond = arrondi((p.salaireMensuel * (JOURS_DU_MOIS_REMUNERES - auMoins)) / JOURS_DU_MOIS_REMUNERES);
  if (Math.round(p.salaireDuBulletin * 100) <= Math.round(plafond * 100)) return null;
  const quels = p.conges
    .filter((c) => c.auMoins > 0)
    .map((c) => `du ${c.du} au ${c.au}`)
    .join(', ');
  const f = (n: number) => n.toFixed(2);
  return (
    `Le bulletin de ${p.mois} paie ${f(p.salaireDuBulletin)} ${p.devise} de salaire alors que ${auMoins} jour(s) de ce mois sont payés par l'allocation de congé (congé ${quels}) · ` +
    `pendant le congé, l'allocation remplace la rémunération, elle ne s'y ajoute pas (Code du travail, art. 142 et 93 ; livre de paie, arrêté du 8 août 2008, mentions 6, 14 et 28). ` +
    `Le salaire des jours hors congé est au plus ${f(plafond)} ${p.devise} (${f(p.salaireMensuel)} × ${JOURS_DU_MOIS_REMUNERES - auMoins} ÷ ${JOURS_DU_MOIS_REMUNERES}) · reprenez la proposition « Absences et congés du mois », ou annulez le congé s'il n'a pas été pris.`
  );
}

export type PropositionDuMois = {
  /** Jours ouvrables du mois payés aux deux tiers (livre de paie, mention 17). */
  readonly joursDeuxTiers: number;
  /** Jours ouvrables du mois non dus (art. 59, art. 93, art. 146 au-delà de quinze jours). */
  readonly joursNonDus: number;
  /** Jours ouvrables d'une cause dont l'arrêté de l'art. 58 manque · rien n'est tranché. */
  readonly joursNonTranches: number;
  /** Jours du mois payés par l'allocation de congé (mention 14), hors du salaire (art. 142). */
  readonly joursDeConge: number;
  /** Jours payés à 100 % sur les vingt-six du mois (mention 6) · `null` quand rien ne se propose. */
  readonly joursPayesAPlein: number | null;
  /** Salaire du mois réduit des jours non dus et des jours à deux tiers · `null` avec son motif. */
  readonly salaireDesJoursDus: number | null;
  /** Les deux tiers des jours d'incapacité (art. 105, 106, 130), moyenne de l'art. 66 comprise, indemnités de la Caisse déduites. */
  readonly indemniteDeuxTiers: number | null;
  /** Indemnités de la Caisse déduites de l'indemnité d'un accident du travail (art. 106, al. 2). */
  readonly deductionsCaisse: number;
  /**
   * Indemnités de la Caisse que l'employeur subrogé reçoit (arrêté n° 146/2018,
   * art. 139 et 146) · la subrogation PARTIELLE bornée à la partie versée
   * (al. 3) · `null` quand cette partie ne se chiffre pas.
   */
  readonly aRecevoirDeLaCaisse: number | null;
  /** Base du mois · vingt-six, ou les jours payables du mois quand l'absence le couvre en entier (mineur 1). */
  readonly baseDuMois: number;
  readonly motifs: readonly string[];
  readonly explication: string | null;
};

/**
 * LA PROPOSITION DU MOIS POUR UN SALAIRE AU MOIS · proposée, jamais
 * substituée. Le mois se paie sur vingt-six jours (décret n° 25/22, art. 7,
 * par analogie, comme le mois entamé du préavis, `REGLE_MOIS_ENTAME`) · un
 * jour ouvrable non dû retranche 1/26 du salaire mensuel, un jour à deux tiers
 * le retranche aussi et rend ses deux tiers en indemnité d'incapacité, sur le
 * salaire PLUS la moyenne mensuelle de l'art. 66 (art. 105, al. 3), qui se
 * déclare (zéro est une réponse, l'absence de réponse n'en est pas une).
 */
export function propositionDuMois(p: {
  readonly jours: readonly JourDuMois[];
  readonly salaireMensuel: number | null;
  readonly moyenneMensuelleArticle66: number | null;
  /** Étape 3 · indemnités de la Caisse du mois, déduites (accident du travail) par arrêt. */
  readonly deductionsParAbsence?: ReadonlyMap<string, number>;
  /** Subrogation TOTALE (art. 139, al. 2) · « à la hauteur de l'indemnité due ». */
  readonly aRecevoirDeLaCaisse?: number;
  /** Subrogation PARTIELLE par arrêt (art. 139, al. 3) · bornée à la partie versée par l'employeur. */
  readonly subrogationsPartielles?: ReadonlyMap<string, number>;
  /** Le mois `AAAA-MM` · sans lui, la base reste vingt-six. */
  readonly mois?: string;
  /** B1 · les congés payés du mois (`congesDuMois`) · leurs jours sortent du salaire. */
  readonly conges?: readonly CongeDuMois[];
}): PropositionDuMois {
  const somme = (r: RegimeRemuneration) => p.jours.filter((j) => j.regime === r).reduce((n, j) => n + j.poids, 0);
  const joursDeuxTiers = somme('DEUX_TIERS');
  const joursNonDus = somme('NON_DUE');
  const joursNonTranches = somme('ARRETE_ABSENT');
  const motifs: string[] = [];
  if (joursNonTranches > 0) {
    motifs.push(
      `${joursNonTranches} jour(s) d'une cause de suspension dont les droits sont fixés par l'arrêté de l'art. 58 du Code du travail, qui n'est pas au corpus · rien n'est proposé, le salaire du mois se saisit.`,
    );
  }
  if (p.salaireMensuel === null) motifs.push("Le contrat n'est pas payé au mois, ou sa rémunération n'est pas renseignée · rien n'est proposé.");
  const conges = p.conges ?? [];
  const nonPlaces = conges.filter((c) => c.joursDeConge === null);
  for (const c of nonPlaces) {
    motifs.push(
      `Le congé du ${c.du} au ${c.au} est à cheval sur deux mois et porte des jours de voyage, dont aucune date ne dit le mois (art. 141, al. 3) · rien n'est proposé, le salaire du mois se saisit, au plus ${c.ouvrablesDuMois} jour(s) de congé retranchés.`,
    );
  }
  const joursDeConge = conges.reduce((n, c) => n + (c.joursDeConge ?? 0), 0);
  if (joursDeuxTiers > 0 && p.moyenneMensuelleArticle66 === null) {
    motifs.push("La moyenne mensuelle des douze mois (art. 66, auquel renvoie l'art. 105) n'est pas déclarée · l'indemnité d'incapacité ne se chiffre pas.");
  }
  // MINEUR 1 DE LA RELECTURE · LE MOIS ENTIER D'ABSENCE. Le forfait de
  // vingt-six jours (décret n° 25/22, art. 7, par analogie) suppose un mois
  // où l'on travaille ; un février d'incapacité n'a que vingt-quatre jours
  // du lundi au samedi, et les deux jours du forfait au-delà se payaient à
  // plein · une incapacité de tout le mois rendait plus que les deux tiers
  // (art. 105, 106, 130). Quand l'absence couvre tous les jours ouvrables du
  // mois, la base est celle des jours PAYABLES du mois (lundi au samedi,
  // fériés compris · art. 93, ils restent payés à plein), jamais vingt-six.
  const base = p.mois ? baseDuMois(p.mois, p.jours.reduce((n, j) => n + j.poids, 0) + joursDeConge) : JOURS_DU_MOIS_REMUNERES;
  const retenus = Math.min(base, joursDeuxTiers + joursNonDus + joursDeConge);
  const bloque = joursNonTranches > 0 || p.salaireMensuel === null || nonPlaces.length > 0;
  const salaireDesJoursDus = bloque ? null : arrondi(((p.salaireMensuel as number) * (base - retenus)) / base);
  const indemniteBrute =
    bloque || (joursDeuxTiers > 0 && p.moyenneMensuelleArticle66 === null)
      ? null
      : arrondi((((p.salaireMensuel as number) + (p.moyenneMensuelleArticle66 ?? 0)) * Math.min(base, joursDeuxTiers) * 2) / (3 * base));
  // ART. 106, AL. 2 · l'indemnité de la Caisse se déduit de la part de
  // l'indemnité qui revient à SON arrêt, jamais au-delà.
  let deductionsCaisse = 0;
  if (indemniteBrute !== null && joursDeuxTiers > 0 && p.deductionsParAbsence) {
    for (const [absenceId, montant] of p.deductionsParAbsence) {
      const siens = p.jours.filter((j) => j.absenceId === absenceId && j.regime === 'DEUX_TIERS').reduce((n, j) => n + j.poids, 0);
      const part = arrondi((indemniteBrute * siens) / joursDeuxTiers);
      deductionsCaisse += Math.min(Math.max(0, montant), part);
    }
    deductionsCaisse = arrondi(deductionsCaisse);
  }
  const indemniteDeuxTiers = indemniteBrute === null ? null : arrondi(indemniteBrute - deductionsCaisse);
  // MINEUR 2 DE LA RELECTURE · LA SUBROGATION PARTIELLE · « Si l'employeur
  // n'a payé qu'une partie de la rémunération, il est subrogé à la limite de
  // la partie versée » (arrêté n° 146/2018, art. 139, al. 3) · la partie
  // versée pour l'arrêt est sa part des deux tiers du mois, jamais plus ; le
  // surplus déclaré revient au travailleur, et c'est dit.
  let aRecevoirDeLaCaisse: number | null = arrondi(p.aRecevoirDeLaCaisse ?? 0);
  for (const [absenceId, montant] of p.subrogationsPartielles ?? new Map<string, number>()) {
    if (indemniteBrute === null || aRecevoirDeLaCaisse === null) {
      aRecevoirDeLaCaisse = null;
      motifs.push(
        "La somme à recevoir de la Caisse par subrogation partielle se borne à la partie versée par l'employeur (arrêté n° 146/2018, art. 139, al. 3) · elle ne se chiffre pas tant que les deux tiers du mois ne se chiffrent pas.",
      );
      break;
    }
    const siens = p.jours.filter((j) => j.absenceId === absenceId && j.regime === 'DEUX_TIERS').reduce((n, j) => n + j.poids, 0);
    const partieVersee = joursDeuxTiers > 0 ? arrondi((indemniteBrute * siens) / joursDeuxTiers) : 0;
    const retenu = Math.min(Math.max(0, montant), partieVersee);
    if (montant > partieVersee + 0.005) {
      motifs.push(
        `L'indemnité de la Caisse déclarée (${montant.toFixed(2)}) dépasse la partie versée par l'employeur pour cet arrêt (${partieVersee.toFixed(2)}) · l'employeur n'est subrogé qu'à la limite de la partie versée (arrêté n° 146/2018, art. 139, al. 3), le surplus revient au travailleur.`,
      );
    }
    aRecevoirDeLaCaisse = arrondi(aRecevoirDeLaCaisse + retenu);
  }
  return {
    joursDeuxTiers,
    joursNonDus,
    joursNonTranches,
    joursDeConge,
    joursPayesAPlein: bloque ? null : base - retenus,
    salaireDesJoursDus,
    indemniteDeuxTiers,
    deductionsCaisse,
    aRecevoirDeLaCaisse,
    baseDuMois: base,
    motifs,
    explication: bloque
      ? null
      : `Salaire mensuel × (${base} − ${retenus}) ÷ ${base}` +
        (base !== JOURS_DU_MOIS_REMUNERES ? ` · l'absence couvre le mois entier, la base est celle de ses ${base} jours payables` : '') +
        (joursDeConge > 0 ? ` ; ${joursDeConge} jour(s) de congé payés par l'allocation, qui remplace le salaire de ces jours (art. 142)` : '') +
        (joursDeuxTiers > 0 ? ` ; indemnité d'incapacité = (salaire mensuel + moyenne de l'art. 66) × ${joursDeuxTiers} × 2/3 ÷ ${base}` : '') +
        (deductionsCaisse > 0 ? `, moins ${deductionsCaisse} versés par la Caisse (art. 106, al. 2)` : '') +
        ' · vingt-six jours payés par mois (décret n° 25/22, art. 7, par analogie), jours fériés de l’absence payés à plein (art. 93).',
  };
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * La base du mois · vingt-six, sauf quand les jours couverts (absences et
 * congés, demi-journées pesées) atteignent tous les jours OUVRABLES du mois ·
 * alors ses jours PAYABLES, du lundi au samedi, fériés compris (mineur 1).
 */
function baseDuMois(mois: string, couverts: number): number {
  const [a, m] = mois.split('-').map(Number);
  let ouvrables = 0;
  let payables = 0;
  for (let d = new Date(Date.UTC(a, m - 1, 1)); d.getUTCMonth() === m - 1; d = plusJours(d, 1)) {
    if (estJourOuvrableDuCode(d)) ouvrables += 1;
    if (estJourRemunere(d)) payables += 1;
  }
  return ouvrables > 0 && couverts >= ouvrables ? payables : JOURS_DU_MOIS_REMUNERES;
}

/**
 * CE QUE LES ABSENCES FONT AU COMPTEUR DES CONGÉS (art. 141, al. 2 et 4) ·
 * les jours hors service, et les jours de maladie qui ne comptent pas comme
 * jours de congé. L'incapacité (maladie, maternité) compte comme service
 * « à concurrence d'un maximum de six mois par année de service considérée
 * séparément » · six mois mesurés de date à date depuis le premier jour
 * d'incapacité de l'année de service, en jours cumulés, convention d'OmegaX
 * dite ; au-delà, hors service. L'accident du travail et la maladie
 * professionnelle comptent sans limite.
 */
export function absencesPourLeCompteur(
  absences: readonly AbsenceLue[],
  origine: JourIso | null,
): { joursHorsService: { du: JourIso; au: JourIso; motif: string }[]; joursMaladie: Set<JourIso> } {
  const joursHorsService: { du: JourIso; au: JourIso; motif: string }[] = [];
  const joursMaladie = new Set<JourIso>();
  // Le cumul des incapacités plafonnées, par année de service.
  const cumul = new Map<number, { premier: JourIso; jours: number }>();
  const anneeDeService = (jour: JourIso): number => {
    if (!origine) return 0;
    const o = jourUtc(origine) as Date;
    let k = 0;
    while (iso(plusMois(o, 12 * (k + 1))) <= jour) k += 1;
    return k;
  };
  const tries = [...absences].sort((x, y) => x.du.localeCompare(y.du));
  for (const a of tries) {
    const def = NATURES_ABSENCE[a.nature];
    const jours = joursDeLAbsence(a);
    if ('refus' in jours) continue;
    if (def.maladie) for (const j of jours) joursMaladie.add(j.jour);
    if (def.conge === 'HORS_SERVICE') {
      joursHorsService.push({ du: a.du, au: a.au, motif: `${def.libelle} (${def.fondement})` });
      continue;
    }
    if (def.conge !== 'INCAPACITE_PLAFONNEE') continue;
    let debutHors: JourIso | null = null;
    let finHors: JourIso | null = null;
    for (const j of jours) {
      const k = anneeDeService(j.jour);
      const c = cumul.get(k) ?? { premier: j.jour, jours: 0 };
      const plafond = Math.round((plusMois(jourUtc(c.premier) as Date, 6).getTime() - (jourUtc(c.premier) as Date).getTime()) / 86_400_000);
      c.jours += 1;
      cumul.set(k, c);
      if (c.jours > plafond) {
        debutHors = debutHors ?? j.jour;
        finHors = j.jour;
      }
    }
    if (debutHors && finHors) {
      joursHorsService.push({
        du: debutHors,
        au: finHors,
        motif: `${def.libelle} au-delà de six mois d'incapacité dans l'année de service (Code du travail, art. 141, al. 2)`,
      });
    }
  }
  return { joursHorsService, joursMaladie };
}

/** Les causes qui ouvrent une indemnité journalière de la Caisse (arrêté n° 146/2018, art. 63 et 87). */
export const NATURES_INDEMNISEES_PAR_LA_CAISSE: ReadonlySet<NatureAbsence> = new Set(['ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', 'MATERNITE']);

/**
 * LE MOTIF DE REFUS D'UNE INDEMNITÉ DE LA CAISSE déclarée sur un arrêt, ou
 * `null`. Trois traitements, chacun son texte · DÉDUITE (accident du
 * travail, art. 106, al. 2), SUBROGATION de l'employeur qui paie toute la
 * rémunération (arrêté n° 146/2018, art. 139, al. 2 ; art. 146, al. 3, ses
 * jours alors payés à plein), SUBROGATION PARTIELLE de l'employeur qui ne paie
 * que les deux tiers du Code (maternité, art. 139, al. 3, ses jours restant
 * aux deux tiers). La maladie non professionnelle n'en ouvre aucune · la Caisse ne
 * couvre que les pensions, les risques professionnels et les prestations aux
 * familles (maternité comprise) ; l'employeur en porte seul les deux tiers
 * (art. 105). La déduction de l'art. 106, al. 2 ne vise que l'accident du
 * travail ou la maladie professionnelle.
 */
export function motifRefusIndemniteCaisse(p: {
  nature: NatureAbsence;
  du: JourIso;
  au: JourIso;
  mois: string;
  montant: number;
  traitement: 'DEDUITE' | 'SUBROGATION' | 'SUBROGATION_PARTIELLE';
  piece: string;
  dejaDeclareCeMois: boolean;
}): string | null {
  if (!NATURES_INDEMNISEES_PAR_LA_CAISSE.has(p.nature)) {
    return `${NATURES_ABSENCE[p.nature].libelle} · aucune indemnité journalière de la Caisse ; seuls l'accident du travail, la maladie professionnelle et la maternité en ouvrent une (arrêté n° 146/2018, art. 63 et 87).`;
  }
  if (p.traitement === 'DEDUITE' && p.nature !== 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE') {
    return "La déduction des sommes versées par la Caisse ne vise que l'accident du travail ou la maladie professionnelle (Code du travail, art. 106, al. 2).";
  }
  if (p.traitement === 'SUBROGATION_PARTIELLE' && p.nature !== 'MATERNITE') {
    return "La subrogation dans la limite de la partie versée ne vise que l'indemnité de maternité (arrêté n° 146/2018, art. 139, al. 3).";
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.mois)) return 'Le mois se lit AAAA-MM.';
  if (p.mois < p.du.slice(0, 7) || p.mois > p.au.slice(0, 7)) return `Le mois ${p.mois} est hors de l'arrêt du ${p.du} au ${p.au}.`;
  if (!Number.isFinite(p.montant) || p.montant <= 0) return "Le montant de l'indemnité est strictement positif.";
  if (p.piece.trim().length < 3) return "La pièce de la Caisse se déclare (décision, bordereau de paiement).";
  if (p.dejaDeclareCeMois) return "Une indemnité de la Caisse est déjà déclarée sur cet arrêt pour ce mois · annulez-la d'abord.";
  return null;
}
