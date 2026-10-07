/**
 * LA RÉMUNÉRATION DU DÉLAI DE PRÉAVIS · décision T9 du 2026-10-07
 * (`docs/decisions-par-la-loi-paie-2026-10-07.md`, constat nouveau).
 *
 * Code du travail, art. 63, al. 3 · l'indemnité « correspond à la rémunération
 * et aux avantages de toute nature dont aurait bénéficié le travailleur durant
 * le délai de préavis qui n'a pas été effectivement respecté ». Art. 93 · « La
 * rémunération est due pour le temps où le travailleur a effectivement fourni
 * ses services ; elle est également due [...] pour les jours fériés légaux ».
 *
 * LE DÉCOMPTE DES JOURS OUVRABLES NE FAIT PAS LE MONTANT. Le délai se compte
 * en jours ouvrables (art. 64), mais le travailleur aurait été payé, pendant
 * ce délai, pour ses jours fériés aussi · chiffrer « jours ouvrables × taux »
 * retranchait de l'indemnité chaque férié du délai (P13 · 3 234 000 au lieu de
 * 3 318 000 pour le délégué, 2 646 000 au lieu de 2 730 000 pour le préavis
 * ordinaire, au détriment du travailleur).
 *
 *  · SALAIRE À LA JOURNÉE · les jours du lundi au samedi du délai, fériés et
 *    samedi portant le congé d'un férié du dimanche compris, au taux du jour
 *    (les vingt-six jours du mois, décret n° 25/22, art. 7).
 *  · SALAIRE AU MOIS · décision par la loi du 2026-10-07 (troisième lot,
 *    point 3, `docs/decisions-par-la-loi-2026-10-07-ter.md`) · les mois
 *    entiers du délai au salaire du mois, le MOIS ENTAMÉ à 1/26 du salaire
 *    mensuel par jour payable, du lundi au samedi, jours fériés compris. Ce
 *    que le travailleur « aurait » reçu pendant un mois entamé (art. 63,
 *    al. 3) est le salaire des jours de ce mois compris dans le délai ; le
 *    livre de paie paie tout salaire, mensuel compris, par jours payés
 *    (arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, art. 1er, mentions 5
 *    « le salaire horaire, journalier ou mensuel » et 6 « le nombre d'heures
 *    ou de jours pour lesquels le salaire est payé à 100 % ») ; la rémunération
 *    est due pour les jours fériés légaux (art. 93) ; le dimanche est le repos
 *    (art. 7, point 9 ; art. 121, al. 2, « Il a lieu le dimanche »). Le passage
 *    du mois au jour n'est écrit pour le salaire ordinaire nulle part · la
 *    seule conversion légale entre valeur journalière et valeur mensuelle est
 *    celle du décret n° 25/22, art. 7 (« en multipliant par 6, 26 et 312 »),
 *    appliquée par ANALOGIE de la loi la plus proche, et c'est dit. Contrôle
 *    de cohérence · vingt-six jours payables à 1/26 rendent un mois plein.
 *
 * LE DÉLAI SE PLACE PAR SES DATES · sans la date de notification, les fériés
 * du délai ne se placent pas, et l'indemnité ne se chiffre pas · elle vaut
 * `null` avec son motif, jamais « jours ouvrables × taux », qui serait un
 * montant plus petit que celui que le texte fixe.
 */
import { natureDuJour, type NatureDuJour } from './jours-du-code-du-travail';

/**
 * Les vingt-six jours du mois (décret n° 25/22, art. 7, par analogie) · un
 * mois entamé se paie, par jour payable, à 1/26 du salaire mensuel.
 */
export const JOURS_DU_MOIS_REMUNERES = 26;

/** Au-delà, le délai se refuse plutôt que de tourner sans fin (dix ans de jours). */
const JOURS_AU_PLUS = 3_660;

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const ENTREE_EN_VIGUEUR_ORDONNANCE_23_042 = '2023-03-30';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const jourUtc = (s: string): Date | null => {
  const m = JOUR.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) || iso(d) !== s ? null : d;
};
const plusJours = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
/** Date à date, le mois d'arrivée plus court s'arrêtant à son dernier jour (même lecture que l'art. 258). */
const plusMois = (d: Date, n: number) => {
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, Math.min(d.getUTCDate(), dernier)));
};

/** Le délai de préavis, placé dans le calendrier. */
export type DelaiDePreavis = {
  /** Premier jour du délai · le lendemain de la notification (art. 64, al. 1). */
  readonly du: string;
  /**
   * Fin du délai, EXCLUE, quand il se compte de date à date (plancher de
   * trois mois de l'art. 258) · `null` quand il se compte en jours ouvrables.
   */
  readonly auExclu: string | null;
};

type JourDuDelai = { readonly date: Date; readonly nature: NatureDuJour; readonly ouvrablesAvant: number };

/** Le lendemain de la notification, ou le refus qui dit pourquoi le délai ne se place pas. */
export function debutDuDelai(dateNotification: string | null | undefined): { du: string } | { refus: string } {
  if (!dateNotification) {
    return {
      refus:
        "La date de notification n'est pas déclarée · l'indemnité est la rémunération du délai (art. 63, al. 3), jours fériés compris (art. 93), et les fériés du délai ne se placent pas sans elle.",
    };
  }
  const notification = jourUtc(dateNotification.slice(0, 10));
  if (!notification) return { refus: 'La date de notification doit être écrite AAAA-MM-JJ.' };
  const du = iso(plusJours(notification, 1));
  if (du < ENTREE_EN_VIGUEUR_ORDONNANCE_23_042) {
    return {
      refus:
        "Le délai commence avant le 30 mars 2023 · la liste des jours fériés antérieure à l'ordonnance n° 23-042 n'est pas au corpus, et la rémunération du délai ne se chiffre pas sans elle.",
    };
  }
  return { du };
}

function joursDuDelai(delai: DelaiDePreavis, joursOuvrables: number): JourDuDelai[] | { refus: string } {
  const debut = jourUtc(delai.du);
  if (!debut) return { refus: 'Le premier jour du délai est illisible.' };
  const fin = delai.auExclu ? jourUtc(delai.auExclu) : null;
  const jours: JourDuDelai[] = [];
  let ouvrables = 0;
  for (let i = 0, d = debut; ; i += 1, d = plusJours(debut, i)) {
    if (i > JOURS_AU_PLUS) return { refus: 'Le délai dépasse dix ans de calendrier · il ne se place pas.' };
    if (fin ? d.getTime() >= fin.getTime() : ouvrables >= joursOuvrables) break;
    const nature = natureDuJour(d);
    jours.push({ date: d, nature, ouvrablesAvant: ouvrables });
    if (nature === 'OUVRABLE') ouvrables += 1;
  }
  return jours;
}

export type RemunerationDuDelai = {
  /** Jours du lundi au samedi de la fenêtre, fériés compris · fractionnaires au bord d'une moitié. */
  readonly joursRemuneres: number;
  /** Dont jours fériés et samedis portant le congé d'un férié du dimanche (art. 93). */
  readonly joursFeriesRemuneres: number;
  /** Mois entiers de la fenêtre, pour un salaire au mois · `null` à la journée. */
  readonly moisEntiers: number | null;
  /** Jours du mois entamé, pour un salaire au mois · `null` à la journée. */
  readonly joursDuMoisEntame: number | null;
  readonly montantFc: number;
  /** Premier et dernier jour rémunérés de la fenêtre. */
  readonly du: string | null;
  readonly au: string | null;
  /** Le calcul et la règle qui le fonde · le mois entamé y est cité quand il a joué. */
  readonly explication: string;
};

/**
 * LA RÈGLE DU MOIS ENTAMÉ, citée dans le fondement de l'indemnité dès qu'elle
 * joue · ce n'est plus une réserve (décision par la loi du 2026-10-07,
 * troisième lot, point 3, qui remplace la convention que ce fichier déclarait).
 */
export const REGLE_MOIS_ENTAME =
  "MOIS ENTAMÉ · les mois entiers du délai se paient au salaire du mois, le mois entamé à 1/26 du salaire mensuel par jour payable, " +
  "du lundi au samedi, jours fériés compris, le dimanche exclu (Code du travail, art. 63, al. 3 ; art. 93 ; art. 7, point 9 ; art. 121, al. 2 ; " +
  "arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, art. 1er, mentions 5 et 6, tout salaire, mensuel compris, se payant par jours payés). " +
  "La conversion d'un mois en vingt-six jours est celle du décret n° 25/22, art. 7, appliquée par analogie de la loi la plus proche · " +
  "vingt-six jours payables rendent un mois plein.";

/**
 * La rémunération d'une fenêtre du délai, en jours ouvrables `(de, a]` comptés
 * depuis le début du délai · tout le délai pour une dispense de l'employeur,
 * ses derniers jours pour un préavis interrompu, les jours d'avant la moitié
 * pour le travailleur parti trop tôt (art. 66, al. 1). Un jour férié (ou un
 * samedi portant le congé d'un férié du dimanche) appartient à la fenêtre qui
 * contient le jour ouvrable qui le SUIT · un férié placé après le dernier jour
 * ouvrable du délai n'en est plus, sauf délai compté de date à date.
 */
export function remunerationDuDelai(p: {
  readonly delai: DelaiDePreavis;
  /** Jours ouvrables du délai entier (art. 64), fractionnaires pour la moitié de l'al. 2. */
  readonly joursOuvrables: number;
  readonly de: number;
  readonly a: number;
  /** La rémunération stipulée · au jour, ou au mois (prime). */
  readonly journaliereFc: number | null;
  readonly mensuelleFc: number | null;
  /** Moyenne MENSUELLE des douze mois (art. 66, al. 3), ajoutée au mois ou, par vingt-six, au jour. */
  readonly moyenneMensuelleFc: number;
}): RemunerationDuDelai | { refus: string } {
  const jours = joursDuDelai(p.delai, p.joursOuvrables);
  if ('refus' in jours) return jours;
  const total = jours.reduce((n, j) => n + (j.nature === 'OUVRABLE' ? 1 : 0), 0);
  const deDate = p.delai.auExclu !== null;
  const de = Math.max(0, p.de);
  const a = Math.min(p.a, deDate ? total : p.joursOuvrables);
  const poids = jours.map((j) => {
    if (j.nature === 'DIMANCHE') return 0;
    if (j.nature === 'OUVRABLE') return Math.max(0, Math.min(j.ouvrablesAvant + 1, a) - Math.max(j.ouvrablesAvant, de));
    // Férié ou congé d'un férié du dimanche · rémunéré (art. 93) s'il est
    // dans la fenêtre. En fin de délai compté de date à date, ceux qui suivent
    // le dernier jour ouvrable en restent.
    const dansLaFenetre = de <= j.ouvrablesAvant && (j.ouvrablesAvant < a || (deDate && a >= total));
    return dansLaFenetre ? 1 : 0;
  });
  const retenus = jours.map((j, i) => ({ ...j, poids: poids[i] })).filter((j) => j.poids > 0);
  const joursRemuneres = retenus.reduce((n, j) => n + j.poids, 0);
  const joursFeriesRemuneres = retenus.filter((j) => j.nature !== 'OUVRABLE').length;
  const du = retenus.length ? iso(retenus[0].date) : null;
  const au = retenus.length ? iso(retenus[retenus.length - 1].date) : null;

  const moyenne = Math.max(0, p.moyenneMensuelleFc);
  if (p.mensuelleFc !== null) {
    // LES MOIS ENTIERS · de date à date depuis le PREMIER JOUR CIVIL de la
    // fenêtre, jusqu'à son dernier jour calendaire (la veille de la fin
    // exclue d'un délai compté de date à date, sinon le dernier jour plein
    // retenu).
    //
    // RELECTURE B1 (2026-10-07) · ils se comptaient depuis le premier jour
    // PAYABLE. Le délai court « à dater du lendemain de la notification »
    // (art. 64, al. 1) · notifié un samedi, il commence un dimanche, et
    // partir du lundi décalait chaque mois d'un jour · délégué de trois ans
    // au mois (art. 258, du 3 mai au 3 août 2026 exclu), 3 234 000 au lieu
    // de 3 276 000. Une fenêtre qui commence en cours de délai (`de`
    // jours ouvrables écoulés) part du lendemain du `de`-ième jour ouvrable,
    // arrondi au jour entier supérieur ; la fraction d'un jour coupé à la
    // moitié (art. 64, al. 2 ; art. 66) le précède et se paie au
    // vingt-sixième.
    const pleins = retenus.filter((j) => j.poids === 1);
    const debutDeLaFenetre = (): Date | null => {
      if (de <= 0) return jourUtc(p.delai.du);
      const rang = Math.ceil(de);
      const exclu = jours.find((j) => j.nature === 'OUVRABLE' && j.ouvrablesAvant === rang - 1);
      return exclu ? plusJours(exclu.date, 1) : null;
    };
    const debut = debutDeLaFenetre();
    let moisEntiers = 0;
    let entame = joursRemuneres;
    if (debut && pleins.length > 0) {
      const finCalendaire =
        deDate && a >= total && p.delai.auExclu ? plusJours(jourUtc(p.delai.auExclu) as Date, -1) : pleins[pleins.length - 1].date;
      while (plusJours(plusMois(debut, moisEntiers + 1), -1).getTime() <= finCalendaire.getTime()) moisEntiers += 1;
      const finDesMois = plusMois(debut, moisEntiers);
      entame = retenus
        .filter((j) => j.date.getTime() < debut.getTime() || j.date.getTime() >= finDesMois.getTime())
        .reduce((n, j) => n + j.poids, 0);
    }
    const parMois = p.mensuelleFc + moyenne;
    const montantFc = moisEntiers * parMois + (entame * parMois) / JOURS_DU_MOIS_REMUNERES;
    return {
      joursRemuneres,
      joursFeriesRemuneres,
      moisEntiers,
      joursDuMoisEntame: entame,
      montantFc,
      du,
      au,
      explication:
        `Délai rémunéré du ${du ?? '?'} au ${au ?? '?'} · ${moisEntiers} mois entier(s) × (salaire mensuel + moyenne de l'art. 66, al. 3)` +
        (entame > 0 ? ` et ${entame} jour(s) du mois entamé × (salaire mensuel + moyenne) ÷ ${JOURS_DU_MOIS_REMUNERES}` : '') +
        ` · jours fériés compris (art. 93), dont ${joursFeriesRemuneres} férié(s) ou samedi(s) portant le congé d'un férié du dimanche.` +
        (entame > 0 ? ` ${REGLE_MOIS_ENTAME}` : ''),
    };
  }
  const parJour = (p.journaliereFc as number) + moyenne / JOURS_DU_MOIS_REMUNERES;
  return {
    joursRemuneres,
    joursFeriesRemuneres,
    moisEntiers: null,
    joursDuMoisEntame: null,
    montantFc: joursRemuneres * parJour,
    du,
    au,
    explication:
      `Délai rémunéré du ${du ?? '?'} au ${au ?? '?'} · ${joursRemuneres} jour(s) du lundi au samedi, ` +
      `jours fériés compris (art. 93), dont ${joursFeriesRemuneres} férié(s) ou samedi(s) portant le congé d'un férié du dimanche, ` +
      `× (taux journalier + moyenne de l'art. 66, al. 3 ramenée au jour par ${JOURS_DU_MOIS_REMUNERES}, décret n° 25/22, art. 7, par analogie).`,
  };
}
