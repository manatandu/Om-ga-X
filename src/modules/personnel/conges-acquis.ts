/**
 * LES CONGÉS ACQUIS CHAQUE MOIS · ligne sage-l5, fonction 79 (décision D9 de
 * `docs/comparaison-sage/reproduction/architecture.md`). Sage tient un
 * compteur de congés par salarié, alimenté chaque mois et repris à la reprise
 * d'un dossier. OmegaX le tient avec les règles du Code du travail, lues dans
 * `droit-travail-congolais` (texte verbatim, titre VI, chapitre VI).
 *
 *   ART. 140, al. 3 · « Le droit au congé naît à l'expiration d'une année de
 *   services comptée de date à date et accomplie chez le même employeur ou un
 *   employeur substitué. » Les jours d'une période annuelle s'ACQUIÈRENT au
 *   fil des mois de service, ils NAISSENT à l'expiration de la période · le
 *   solde que le salarié peut prendre est fait des seuls droits nés.
 *
 *   ART. 141, al. 1 · « au moins un jour ouvrable par mois entier de service »
 *   au-delà de dix-huit ans, « un jour ouvrable et demi » en deçà, et « un jour
 *   ouvrable par tranche de cinq années d'ancienneté ». Le taux et la tranche
 *   viennent de `decompte-final.ts` (`CONGE_JOURS_PAR_MOIS_*`,
 *   `trancheDAnciennete`) · aucune seconde règle. La tranche est due ENTIÈRE à
 *   la période qui compte au moins un mois entier (décision T6 du 2026-10-07).
 *
 *   ART. 141, al. 2 · « Les services pris en considération [...] comprennent
 *   les jours de prestation de travail, de repos hebdomadaire, de congé payé et
 *   les jours fériés légaux, ainsi que les périodes de suspension due à
 *   l'incapacité de travail à concurrence d'un maximum de six mois par année
 *   de service ». Un jour qui n'est pas un service (mise à pied, absence non
 *   rémunérée) fait que le mois qui le contient n'est pas un MOIS ENTIER de
 *   service · lecture littérale, dite à l'écran avec le jour en cause, et
 *   remontée à Manasse (fiche de la ligne). Les absences viennent de la
 *   fonction 78 (`absences-salarie.ts`).
 *
 *   ART. 141, al. 3 et 4 · « La durée du voyage n'est pas comprise dans le
 *   congé » ; « Les jours de maladie compris dans la période de congé ne
 *   comptent pas comme jours de congé. » D'où `joursDuConge`.
 *
 *   ART. 140, al. 4 · « la prise effective du congé [ne peut] dépasser de six
 *   mois la date prévue pour son ouverture » · signalé, jamais refusé (le
 *   logiciel n'empêche pas de constater un retard, il le dit).
 *
 * LE MOIS DE SERVICE SE COMPTE DE DATE À DATE depuis l'entrée en service, comme
 * l'année de l'art. 140 · le mois civil ferait perdre un jour à tout salarié
 * entré un 15 (onze mois civils entiers dans sa première année). Un mois de
 * service est ACQUIS quand il est révolu, que le contrat le couvre en entier,
 * que CHAQUE MOIS CIVIL qu'il touche porte un bulletin émis (« alimenté à
 * chaque bulletin émis »), et qu'aucun de ses jours n'est hors service. Avant
 * le premier bulletin d'OmegaX, c'est la REPRISE déclarée par le cabinet, avec
 * sa source, qui dit ce qui était acquis (convention d'OmegaX pour le mois à
 * cheval sur la date de la reprise · sa part antérieure est tenue pour
 * service, la reprise la couvrant).
 *
 * NULL N'EST PAS ZÉRO · un âge que le registre ne permet pas de dire rend le
 * mois non chiffré, et avec lui le solde, au lieu d'un jour présumé.
 */
import {
  CONGE_JOURS_PAR_MOIS_MAJEUR,
  CONGE_JOURS_PAR_MOIS_MINEUR,
  trancheDAnciennete,
} from './decompte-final';
import { estJourOuvrableDuCode } from './jours-du-code-du-travail';
import { plusMois } from './remuneration-du-delai';

/** AAAA-MM-JJ. */
export type JourIso = string;

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const iso = (d: Date): JourIso => d.toISOString().slice(0, 10);
export const jourUtc = (s: string): Date | null => {
  const m = JOUR.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) || iso(d) !== s ? null : d;
};
const plusJours = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const moisCivil = (d: Date) => iso(d).slice(0, 7);

/** Au-delà, le compteur se refuse plutôt que de tourner sans fin (cinquante ans de service). */
const PERIODES_AU_PLUS = 50;

/**
 * Le travailleur a-t-il MOINS de dix-huit ans à cette date ? `null` quand le
 * registre ne permet pas de le dire · seul le millésime connu, l'année des
 * dix-huit ans est ambiguë (art. 212, point 5, admet le millésime présumé).
 */
export function moinsDeDixHuitAnsAu(
  date: Date,
  dateNaissance: Date | null,
  millesimeNaissance: number | null,
): boolean | null {
  if (dateNaissance) return date.getTime() < plusMois(dateNaissance, 18 * 12).getTime();
  if (millesimeNaissance === null) return null;
  const ecart = date.getUTCFullYear() - millesimeNaissance;
  if (ecart > 18) return false;
  if (ecart < 18) return true;
  return null;
}

export type StatutMoisDeService =
  /** Mois entier de service, révolu, payé, sans jour hors service. */
  | 'ACQUIS'
  /** Couvert par la reprise déclarée. */
  | 'REPRIS'
  /** Pas encore révolu. */
  | 'EN_COURS'
  /** Un mois civil qu'il touche n'a aucun bulletin émis. */
  | 'SANS_BULLETIN'
  /** Un de ses jours n'est pas un service au sens de l'art. 141, al. 2. */
  | 'NON_ENTIER'
  /** Le contrat ne le couvre pas en entier (fin de service). */
  | 'HORS_CONTRAT'
  /** L'âge ne se dit pas · ni date de naissance ni millésime sans ambiguïté. */
  | 'AGE_INCONNU';

export type MoisDeService = {
  readonly du: JourIso;
  readonly au: JourIso;
  readonly statut: StatutMoisDeService;
  /** Jours acquis · 1 ou 1,5, zéro hors de l'acquis, `null` quand l'âge manque. */
  readonly jours: number | null;
  readonly motif: string | null;
};

export type PeriodeDeConges = {
  readonly rang: number;
  readonly du: JourIso;
  readonly au: JourIso;
  /** NEE · l'année est révolue, le droit est né (art. 140, al. 3). */
  readonly etat: 'NEE' | 'EN_COURS' | 'REPRISE' | 'FIN_DE_SERVICE';
  readonly mois: readonly MoisDeService[];
  readonly moisAcquis: number;
  readonly joursDeBase: number | null;
  readonly joursDAnciennete: number;
  readonly joursAcquis: number | null;
};

export type FaitsDuCompteur = {
  /** Premier jour de service (premier contrat de la chaîne). */
  readonly origine: JourIso;
  /** Dernier jour de service quand le contrat est terminé, sinon `null`. */
  readonly fin: JourIso | null;
  readonly dateNaissance: JourIso | null;
  readonly millesimeNaissance: number | null;
  /** Mois civils (AAAA-MM) qui portent un bulletin émis, non annulé. */
  readonly moisPayes: readonly string[];
  /** Jours qui ne sont pas un service au sens de l'art. 141, al. 2 (fonction 78). */
  readonly joursHorsService: readonly { readonly du: JourIso; readonly au: JourIso; readonly motif: string }[];
  readonly reprise: {
    readonly arreteAu: JourIso;
    readonly joursNesNonPris: number;
    readonly moisEnCoursAccomplis: number;
  } | null;
  /** Congés pris ou posés, non annulés, avec leurs jours déjà comptés. */
  readonly conges: readonly { readonly id: string; readonly du: JourIso; readonly jours: number }[];
  /** Jour de lecture. */
  readonly aLa: JourIso;
};

export type CompteurConges = {
  readonly periodes: readonly PeriodeDeConges[];
  /** Droits nés (reprise comprise) · `null` si une période née n'est pas chiffrée. */
  readonly droitsNes: number | null;
  /** Jours des congés pris ou posés depuis la reprise. */
  readonly pris: number;
  /** Droits nés moins pris · négatif quand un congé a été pris par anticipation. */
  readonly solde: number | null;
  /** Jours de la période en cours (droit à naître). */
  readonly enCours: number | null;
  /** Ce qui doit être dit · retard de l'art. 140, al. 4, mois sans bulletin, âge. */
  readonly signaux: readonly string[];
  /** Congés antérieurs à la reprise · couverts par elle, non décomptés. */
  readonly congesAvantReprise: readonly string[];
};

/** Le refus d'une reprise · `null` quand elle se reçoit. */
export function motifRefusReprise(p: {
  origine: JourIso;
  arreteAu: JourIso;
  joursNesNonPris: number;
  moisEnCoursAccomplis: number;
  source: string;
}): string | null {
  const origine = jourUtc(p.origine);
  const arrete = jourUtc(p.arreteAu);
  if (!origine || !arrete) return 'La date de la reprise doit être écrite AAAA-MM-JJ.';
  if (arrete.getTime() < origine.getTime()) {
    return `La reprise est arrêtée avant l'entrée en service (${p.origine}) · rien n'était acquis.`;
  }
  if (!Number.isFinite(p.joursNesNonPris) || p.joursNesNonPris < 0 || Math.round(p.joursNesNonPris * 2) !== p.joursNesNonPris * 2) {
    return 'Les jours nés et non pris se déclarent en jours ou demi-jours, zéro compris.';
  }
  if (!Number.isInteger(p.moisEnCoursAccomplis) || p.moisEnCoursAccomplis < 0 || p.moisEnCoursAccomplis > 11) {
    return 'Les mois de service accomplis dans la période en cours vont de 0 à 11 · douze mois font une période révolue.';
  }
  // Les mois déclarés ne dépassent pas ceux qui se sont écoulés dans la
  // période annuelle en cours à la date de la reprise.
  let rang = 0;
  while (plusMois(origine, 12 * (rang + 1)).getTime() <= arrete.getTime()) rang += 1;
  const debutPeriode = plusMois(origine, 12 * rang);
  let ecoules = 0;
  while (ecoules < 12 && plusJours(plusMois(debutPeriode, ecoules + 1), -1).getTime() <= arrete.getTime()) ecoules += 1;
  if (p.moisEnCoursAccomplis > ecoules) {
    return `La période annuelle en cours a commencé le ${iso(debutPeriode)} · au ${p.arreteAu}, ${ecoules} mois de service s'y sont écoulés, pas ${p.moisEnCoursAccomplis}.`;
  }
  if (p.source.trim().length < 3) return 'La source de la reprise est exigée (registre des congés, ancien logiciel, attestation…).';
  return null;
}

/**
 * LES JOURS D'UN CONGÉ · jours ouvrables du Code (art. 7, point 9, samedi
 * compris, dimanche, fériés et samedi portant le congé d'un férié du dimanche
 * exclus) entre deux dates incluses, moins les jours de maladie qu'il contient
 * (art. 141, al. 4) et les jours de voyage déclarés (al. 3).
 */
export function joursDuConge(p: {
  du: JourIso;
  au: JourIso;
  joursVoyage: number;
  joursMaladie: ReadonlySet<JourIso>;
}): { jours: number; ouvrables: number; maladie: number } | { refus: string } {
  const du = jourUtc(p.du);
  const au = jourUtc(p.au);
  if (!du || !au) return { refus: 'Les dates du congé doivent être écrites AAAA-MM-JJ.' };
  if (au.getTime() < du.getTime()) return { refus: 'Le congé finit avant de commencer.' };
  if (au.getTime() - du.getTime() > 400 * 86_400_000) return { refus: 'Un congé de plus de quatre cents jours ne se pose pas · vérifiez les dates.' };
  let ouvrables = 0;
  let maladie = 0;
  for (let d = du; d.getTime() <= au.getTime(); d = plusJours(d, 1)) {
    if (!estJourOuvrableDuCode(d)) continue;
    if (p.joursMaladie.has(iso(d))) maladie += 1;
    else ouvrables += 1;
  }
  if (!Number.isInteger(p.joursVoyage) || p.joursVoyage < 0) return { refus: 'Les jours de voyage se comptent en jours entiers, zéro compris.' };
  if (p.joursVoyage > ouvrables) {
    return { refus: `Le congé ne compte que ${ouvrables} jour(s) ouvrable(s) · ${p.joursVoyage} jour(s) de voyage ne s'en retranchent pas.` };
  }
  return { jours: ouvrables - p.joursVoyage, ouvrables, maladie };
}

/**
 * ART. 145, al. 1 · « au plus tard le dernier jour ouvrable avant le départ en
 * congé ». Le jour ouvrable du Code, samedi compris.
 */
export function dernierJourOuvrableAvant(du: JourIso): JourIso | null {
  const d = jourUtc(du);
  if (!d) return null;
  for (let j = plusJours(d, -1), n = 0; n < 15; j = plusJours(j, -1), n += 1) {
    if (estJourOuvrableDuCode(j)) return iso(j);
  }
  return null;
}

const recouvre = (a: { du: Date; au: Date }, du: JourIso, au: JourIso) => {
  const d = jourUtc(du);
  const f = jourUtc(au);
  if (!d || !f) return false;
  return d.getTime() <= a.au.getTime() && f.getTime() >= a.du.getTime();
};

function moisCivilsEntre(du: Date, au: Date): string[] {
  const sortie: string[] = [];
  let curseur = new Date(Date.UTC(du.getUTCFullYear(), du.getUTCMonth(), 1));
  while (curseur.getTime() <= au.getTime()) {
    sortie.push(moisCivil(curseur));
    curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 1));
  }
  return sortie;
}

/** Le compteur d'un salarié à une date · voir l'en-tête pour les règles. */
export function compteurConges(f: FaitsDuCompteur): CompteurConges | { refus: string } {
  const origine = jourUtc(f.origine);
  const aLa = jourUtc(f.aLa);
  if (!origine || !aLa) return { refus: 'Dates du compteur illisibles.' };
  const fin = f.fin ? jourUtc(f.fin) : null;
  const naissance = f.dateNaissance ? jourUtc(f.dateNaissance) : null;
  const arrete = f.reprise ? jourUtc(f.reprise.arreteAu) : null;
  if (f.reprise && !arrete) return { refus: 'Date de la reprise illisible.' };
  const payes = new Set(f.moisPayes);
  const signaux: string[] = [];

  const periodes: PeriodeDeConges[] = [];
  const limite = fin && fin.getTime() < aLa.getTime() ? fin : aLa;
  for (let rang = 0; rang < PERIODES_AU_PLUS; rang += 1) {
    const debutP = plusMois(origine, 12 * rang);
    if (debutP.getTime() > limite.getTime()) break;
    const finP = plusJours(plusMois(origine, 12 * (rang + 1)), -1);
    const revolue = finP.getTime() < aLa.getTime();
    const coupeeParLaFin = fin !== null && finP.getTime() > fin.getTime();

    // PÉRIODE ENTIÈREMENT COUVERTE PAR LA REPRISE · ses jours sont dans les
    // jours nés déclarés, rien ne se recompte.
    if (arrete && finP.getTime() <= arrete.getTime()) {
      periodes.push({
        rang,
        du: iso(debutP),
        au: iso(finP),
        etat: 'REPRISE',
        mois: [],
        moisAcquis: 0,
        joursDeBase: null,
        joursDAnciennete: 0,
        joursAcquis: null,
      });
      continue;
    }

    const mois: MoisDeService[] = [];
    let ageInconnu = false;
    for (let m = 0; m < 12; m += 1) {
      const du = plusMois(origine, 12 * rang + m);
      if (du.getTime() > limite.getTime()) break;
      const au = plusJours(plusMois(origine, 12 * rang + m + 1), -1);
      const ligne = (statut: StatutMoisDeService, jours: number | null, motif: string | null): MoisDeService => ({
        du: iso(du),
        au: iso(au),
        statut,
        jours,
        motif,
      });
      if (fin && au.getTime() > fin.getTime()) {
        mois.push(ligne('HORS_CONTRAT', 0, `Le service a pris fin le ${iso(fin)} · le mois n'est pas entier.`));
        continue;
      }
      if (au.getTime() >= aLa.getTime()) {
        mois.push(ligne('EN_COURS', 0, null));
        continue;
      }
      if (arrete && au.getTime() <= arrete.getTime()) {
        mois.push(ligne('REPRIS', 0, null));
        continue;
      }
      const partDu = arrete && du.getTime() <= arrete.getTime() ? plusJours(arrete, 1) : du;
      const sansBulletin = moisCivilsEntre(partDu, au).filter((mc) => !payes.has(mc));
      if (sansBulletin.length > 0) {
        mois.push(ligne('SANS_BULLETIN', 0, `Aucun bulletin émis pour ${sansBulletin.join(', ')}.`));
        continue;
      }
      const hors = f.joursHorsService.find((h) => recouvre({ du: partDu, au }, h.du, h.au));
      if (hors) {
        mois.push(ligne('NON_ENTIER', 0, `${hors.motif} (du ${hors.du} au ${hors.au}) · ce jour n'est pas un service au sens de l'article 141, alinéa 2.`));
        continue;
      }
      const mineur = moinsDeDixHuitAnsAu(du, naissance, f.millesimeNaissance);
      if (mineur === null) {
        ageInconnu = true;
        mois.push(ligne('AGE_INCONNU', null, "Ni la date de naissance ni le millésime ne disent si le travailleur avait moins de dix-huit ans."));
        continue;
      }
      mois.push(ligne('ACQUIS', mineur ? CONGE_JOURS_PAR_MOIS_MINEUR : CONGE_JOURS_PAR_MOIS_MAJEUR, null));
    }

    // LA PÉRIODE À CHEVAL SUR LA REPRISE · ses mois antérieurs sont ceux que
    // le cabinet a déclarés, au taux de l'âge à la date de la reprise.
    let moisDeclares = 0;
    let baseDeclaree: number | null = 0;
    if (arrete && f.reprise && debutP.getTime() <= arrete.getTime()) {
      moisDeclares = f.reprise.moisEnCoursAccomplis;
      if (moisDeclares > 0) {
        const mineur = moinsDeDixHuitAnsAu(arrete, naissance, f.millesimeNaissance);
        baseDeclaree = mineur === null ? null : moisDeclares * (mineur ? CONGE_JOURS_PAR_MOIS_MINEUR : CONGE_JOURS_PAR_MOIS_MAJEUR);
        if (mineur === null) ageInconnu = true;
      }
    }
    const acquis = mois.filter((x) => x.statut === 'ACQUIS');
    const moisAcquis = acquis.length + moisDeclares;
    const joursDeBase =
      ageInconnu || baseDeclaree === null ? null : acquis.reduce((s, x) => s + (x.jours ?? 0), 0) + baseDeclaree;
    // DÉCISION T6 · la tranche est due entière dès un mois entier. Révolue,
    // la période porte l'ancienneté atteinte à son terme (rang + 1 années) ;
    // en cours, celle atteinte à la date de lecture (rang années révolues).
    const joursDAnciennete = moisAcquis > 0 ? trancheDAnciennete(revolue && !coupeeParLaFin ? rang + 1 : rang) : 0;
    periodes.push({
      rang,
      du: iso(debutP),
      au: iso(finP),
      etat: coupeeParLaFin ? 'FIN_DE_SERVICE' : revolue ? 'NEE' : 'EN_COURS',
      mois,
      moisAcquis,
      joursDeBase,
      joursDAnciennete,
      joursAcquis: joursDeBase === null ? null : joursDeBase + joursDAnciennete,
    });
  }
  if (periodes.length === PERIODES_AU_PLUS) {
    return { refus: 'Le service compte plus de cinquante années · vérifiez la date d’entrée du contrat.' };
  }

  const nees = periodes.filter((p) => p.etat === 'NEE');
  const droitsNes =
    nees.some((p) => p.joursAcquis === null) ? null : (f.reprise?.joursNesNonPris ?? 0) + nees.reduce((s, p) => s + (p.joursAcquis ?? 0), 0);
  const congesApres = f.conges.filter((c) => !arrete || (jourUtc(c.du)?.getTime() ?? 0) > arrete.getTime());
  const congesAvantReprise = f.conges.filter((c) => !congesApres.includes(c)).map((c) => c.id);
  const pris = congesApres.reduce((s, c) => s + c.jours, 0);
  const enCoursP = periodes.find((p) => p.etat === 'EN_COURS' || p.etat === 'FIN_DE_SERVICE') ?? null;

  // ART. 140, al. 4 · les droits nés se consomment du plus ancien au plus
  // récent ; ceux qui restent six mois après leur naissance sont signalés.
  if (droitsNes !== null) {
    const nes: { neLe: Date; jours: number }[] = [];
    if (f.reprise && arrete && f.reprise.joursNesNonPris > 0) nes.push({ neLe: arrete, jours: f.reprise.joursNesNonPris });
    for (const p of nees) nes.push({ neLe: plusJours(jourUtc(p.au) as Date, 1), jours: p.joursAcquis ?? 0 });
    let aConsommer = pris;
    for (const n of nes) {
      const consomme = Math.min(n.jours, aConsommer);
      aConsommer -= consomme;
      const reste = n.jours - consomme;
      if (reste > 0 && plusMois(n.neLe, 6).getTime() < aLa.getTime()) {
        signaux.push(
          `${reste} jour(s) de congé nés le ${iso(n.neLe)} ne sont pas pris six mois après · la prise effective ne peut dépasser de six mois la date prévue pour l'ouverture du congé (article 140, alinéa 4).`,
        );
      }
    }
  }
  const sansBulletin = periodes.flatMap((p) => p.mois).filter((m) => m.statut === 'SANS_BULLETIN');
  if (sansBulletin.length > 0) {
    signaux.push(
      `${sansBulletin.length} mois de service sans bulletin émis ne sont pas comptés` +
        (f.reprise ? '.' : ' · si ces mois ont été payés hors d’OmegaX, déclarez la reprise des congés acquis.'),
    );
  }
  if (periodes.some((p) => p.joursAcquis === null && p.etat !== 'REPRISE')) {
    signaux.push("L'âge du travailleur ne se dit pas sur un mois au moins · renseignez la date de naissance au registre.");
  }
  return {
    periodes,
    droitsNes,
    pris,
    solde: droitsNes === null ? null : droitsNes - pris,
    enCours: enCoursP ? enCoursP.joursAcquis : 0,
    signaux,
    congesAvantReprise,
  };
}
