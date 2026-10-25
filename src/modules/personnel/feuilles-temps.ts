/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · LES FEUILLES DE TEMPS ET LES COMPTEURS
 * LIBRES D'HEURES. Moteur pur.
 *
 * Aucun texte ne régit la FEUILLE elle-même · la tenir est un choix
 * d'organisation de Manasse (fonction cochée « À faire »). Ce que la feuille
 * fait des heures, en revanche, se lit au Code du travail, et seulement là.
 *
 *  · Art. 119, al. 1 · la durée légale « ne peut excéder quarante-cinq heures
 *    par semaine et huit heures par jour » ; al. 4 · « Les heures effectuées
 *    au-delà de la durée légale du travail sont considérées comme heures
 *    supplémentaires et donnent droit à une majoration de salaire. »
 *  · Art. 120 · les arrêtés qui fixent, par branche, les modalités
 *    d'application, le nombre d'heures supplémentaires autorisées, les
 *    réductions des limites et la rémunération des heures supplémentaires ne
 *    sont pas au corpus · aucun plafond n'est opposé, aucun taux n'est servi
 *    (`heures-majorees.ts`, le taux se DÉCLARE avec sa source).
 *  · Art. 121, al. 1 et 2 · un repos « au cours de chaque période de sept
 *    jours », qui « a lieu le dimanche ».
 *  · Art. 124 · le travail de nuit, « exécuté entre 19 heures et 5 heures »,
 *    « doit être payé avec majoration, sans préjudice des dispositions
 *    relatives au paiement des heures supplémentaires ».
 *
 * UNE HEURE SUPPLÉMENTAIRE NE SE COMPTE QU'UNE FOIS, AU-DELÀ DE L'UNE OU DE
 * L'AUTRE LIMITE · la durée légale porte DEUX bornes cumulatives (« et »).
 * Une heure au-delà de huit dans la journée dépasse la durée légale du jour,
 * même dans une semaine qui reste sous quarante-cinq ; une heure dans les huit
 * du jour mais au-delà de quarante-cinq dans la semaine dépasse celle de la
 * semaine. On compte donc, par semaine · les heures au-delà de huit de chaque
 * jour, puis, sur les heures restées dans les huit, ce qui passe quarante-cinq.
 * C'est la lecture d'OmegaX · l'arrêté de l'art. 120, a) qui en dirait les
 * modalités n'est pas au corpus, et l'autre lecture (la semaine seule) rendrait
 * moins au travailleur · une règle de protection ne se tranche pas contre celui
 * qu'elle protège (CLAUDE.md, P5).
 *
 * LA SEMAINE VA DU LUNDI AU DIMANCHE · le Code ne la définit pas ; il fixe le
 * repos le dimanche (art. 121, al. 2), qui clôt la période de sept jours. Une
 * semaine se PAIE au mois de son dimanche · son total n'est connu qu'une fois
 * finie · sauf si le service du salarié s'achève avant ce dimanche, auquel cas
 * elle se paie au mois de la fin du service (le bulletin du mois suivant
 * n'existerait pas). Convention d'OmegaX, dite à l'écran (bulle).
 *
 * UN JOUR NON COUVERT N'EST PAS UN JOUR À ZÉRO · un jour de contrat qu'aucune
 * feuille ne couvre est INCONNU, et la limite de la semaine qui le contient ne
 * se calcule pas (`null`, nommé), là où les heures au-delà de huit des jours
 * connus restent certaines. Un jour hors de tout contrat est connu, à zéro ·
 * aucune heure n'y est admise.
 *
 * LES HEURES SE COMPTENT EN CENTIÈMES D'HEURE ENTIERS · un flottant faisait
 * d'un total de 45 heures exactement 44,99999 (voir `personnel/au-centime.ts`
 * pour le même défaut sur les seuils).
 */
import { natureDuJour } from './jours-du-code-du-travail';

export type JourIso = string;

/** Art. 119, al. 1. */
export const DUREE_LEGALE_JOUR_CENTIEMES = 800;
export const DUREE_LEGALE_SEMAINE_CENTIEMES = 4_500;
/** Un jour civil ne porte que vingt-quatre heures. */
export const HEURES_DU_JOUR_AU_PLUS = 24;
/**
 * Art. 124 · « entre 19 heures et 5 heures » · un jour civil, de minuit à
 * minuit, n'en contient que dix (de 0 h à 5 h, puis de 19 h à 24 h).
 */
export const HEURES_DE_NUIT_DU_JOUR_AU_PLUS = 10;
/** Une feuille couvre au plus trente et un jours · convention d'OmegaX, la paie se lit au mois. */
export const JOURS_DE_LA_FEUILLE_AU_PLUS = 31;
/** Les compteurs libres d'un dossier · convention d'OmegaX. */
export const COMPTEURS_DU_DOSSIER_AU_PLUS = 30;

const JOUR_MS = 86_400_000;

export const enCentiemes = (heures: number): number => Math.round(heures * 100);
export const enHeures = (centiemes: number): number => centiemes / 100;

export function jourUtc(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : d;
}

export const iso = (d: Date): JourIso => d.toISOString().slice(0, 10);
const plusJours = (d: Date, n: number): Date => new Date(d.getTime() + n * JOUR_MS);

/** Le lundi de la semaine du jour (le dimanche clôt la semaine, art. 121, al. 2). */
export function lundiDe(d: Date): Date {
  const decalage = (d.getUTCDay() + 6) % 7;
  return plusJours(d, -decalage);
}

/** Les jours, du premier au dernier, compris. */
export function joursEntre(du: Date, au: Date): JourIso[] {
  const sortie: JourIso[] = [];
  for (let t = du.getTime(); t <= au.getTime(); t += JOUR_MS) sortie.push(iso(new Date(t)));
  return sortie;
}

export function motifRefusPeriode(du: string, au: string): string | null {
  const a = jourUtc(du.slice(0, 10));
  const b = jourUtc(au.slice(0, 10));
  if (!a || !b) return 'Les dates de la feuille se lisent AAAA-MM-JJ.';
  if (b.getTime() < a.getTime()) return 'Le dernier jour de la feuille précède le premier.';
  const n = Math.round((b.getTime() - a.getTime()) / JOUR_MS) + 1;
  if (n > JOURS_DE_LA_FEUILLE_AU_PLUS) {
    return `Une feuille couvre au plus ${JOURS_DE_LA_FEUILLE_AU_PLUS} jours · découpez la période en plusieurs feuilles.`;
  }
  return null;
}

/** Les heures d'un jour · positives, au centième, vingt-quatre au plus ; la nuit en fait partie. */
export function motifRefusHeuresDuJour(p: { jour: string; heures: number; heuresNuit: number }): string | null {
  const ok = (n: number) => Number.isFinite(n) && n >= 0 && Math.abs(enCentiemes(n) - n * 100) < 1e-6;
  if (!ok(p.heures)) return `${p.jour} · les heures sont un nombre positif ou nul, au centième d'heure.`;
  if (!ok(p.heuresNuit)) return `${p.jour} · les heures de nuit sont un nombre positif ou nul, au centième d'heure.`;
  if (p.heures > HEURES_DU_JOUR_AU_PLUS) return `${p.jour} · un jour ne porte que ${HEURES_DU_JOUR_AU_PLUS} heures.`;
  if (enCentiemes(p.heuresNuit) > enCentiemes(p.heures)) {
    return `${p.jour} · les heures de nuit font partie des heures du jour, elles ne les dépassent pas.`;
  }
  if (p.heuresNuit > HEURES_DE_NUIT_DU_JOUR_AU_PLUS) {
    return `${p.jour} · le travail de nuit se situe entre 19 heures et 5 heures (Code du travail, art. 124) · un jour civil n'en porte que ${HEURES_DE_NUIT_DU_JOUR_AU_PLUS}.`;
  }
  return null;
}

export function motifRefusCompteur(p: { code: string; libelle: string }): string | null {
  if (!/^[A-Z0-9_-]{1,10}$/.test(p.code)) return 'Le code du compteur tient en dix caractères au plus · lettres majuscules, chiffres, tiret ou souligné.';
  if (p.libelle.trim().length < 3 || p.libelle.trim().length > 60) return 'Le compteur se nomme (trois à soixante caractères).';
  return null;
}

/** Ce qu'on sait d'un jour · ses heures, ou rien (aucune feuille ne le couvre). */
export type JourConnu = { heures: number; heuresNuit: number } | null;

/** Une semaine, du lundi au dimanche · un jour absent du tableau est un jour hors contrat, connu à zéro. */
export type SemaineLue = {
  lundi: JourIso;
  dimanche: JourIso;
  /** Les jours couverts par une feuille ou hors contrat · `null` pour un jour de contrat non couvert. */
  jours: Record<JourIso, JourConnu>;
};

export type CompteDeLaSemaine = {
  lundi: JourIso;
  dimanche: JourIso;
  heures: number;
  /** Au-delà de huit heures dans la journée · certaines, même si la semaine est incomplète. */
  supplementairesDuJour: number;
  /** Dans les huit du jour, au-delà de quarante-cinq dans la semaine · `null` si un jour manque. */
  supplementairesDeLaSemaine: number | null;
  heuresNuit: number;
  heuresSamedi: number;
  heuresDimanche: number;
  heuresFerie: number;
  joursNonCouverts: JourIso[];
};

/** Le compte d'une semaine, au centième d'heure près. */
export function compterLaSemaine(s: SemaineLue): CompteDeLaSemaine {
  let total = 0;
  let duJour = 0;
  let dansLesHuit = 0;
  let nuit = 0;
  let samedi = 0;
  let dimanche = 0;
  let ferie = 0;
  const nonCouverts: JourIso[] = [];
  const debut = jourUtc(s.lundi)!;
  for (let k = 0; k < 7; k += 1) {
    const d = plusJours(debut, k);
    const j = iso(d);
    const lu = j in s.jours ? s.jours[j] : { heures: 0, heuresNuit: 0 };
    if (lu === null) {
      nonCouverts.push(j);
      continue;
    }
    const h = enCentiemes(lu.heures);
    total += h;
    const auDela = Math.max(0, h - DUREE_LEGALE_JOUR_CENTIEMES);
    duJour += auDela;
    dansLesHuit += h - auDela;
    nuit += enCentiemes(lu.heuresNuit);
    // LE SAMEDI, LE DIMANCHE ET LES FÉRIÉS · « les suppléments éventuellement
    // payés pour le travail du samedi, du dimanche et des jours fériés
    // légaux » (arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, mention 11).
    // Le samedi qui porte le congé d'un férié tombé un dimanche est compté
    // avec les fériés (ordonnance n° 23-042, art. 2 ; `jours-du-code-du-travail.ts`).
    const nature = natureDuJour(d);
    if (nature === 'DIMANCHE') dimanche += h;
    else if (nature === 'FERIE' || nature === 'CONGE_DU_FERIE_DU_DIMANCHE') ferie += h;
    else if (d.getUTCDay() === 6) samedi += h;
  }
  const deLaSemaine = nonCouverts.length > 0 ? null : Math.max(0, dansLesHuit - DUREE_LEGALE_SEMAINE_CENTIEMES);
  return {
    lundi: s.lundi,
    dimanche: s.dimanche,
    heures: enHeures(total),
    supplementairesDuJour: enHeures(duJour),
    supplementairesDeLaSemaine: deLaSemaine === null ? null : enHeures(deLaSemaine),
    heuresNuit: enHeures(nuit),
    heuresSamedi: enHeures(samedi),
    heuresDimanche: enHeures(dimanche),
    heuresFerie: enHeures(ferie),
    joursNonCouverts: nonCouverts,
  };
}

/**
 * LE MOIS OÙ SE PAIE UNE SEMAINE · celui de son dimanche, sauf si le service
 * s'achève avant (le mois de la fin du service).
 */
export function moisDePaiementDeLaSemaine(lundi: Date, finDeService: Date | null): string {
  const dimanche = plusJours(lundi, 6);
  const borne = finDeService && finDeService.getTime() >= lundi.getTime() && finDeService.getTime() < dimanche.getTime() ? finDeService : dimanche;
  return iso(borne).slice(0, 7);
}

/** Les semaines qui se paient au mois · leurs lundis. */
export function semainesPayeesAuMois(mois: string, finDeService: Date | null): Date[] {
  const [a, m] = mois.split('-').map(Number);
  const premier = new Date(Date.UTC(a, m - 1, 1));
  const dernier = new Date(Date.UTC(a, m, 0));
  // Toute semaine payée en M a son lundi entre le lundi du premier du mois et
  // le dernier jour du mois · on les essaie toutes, la règle tranche.
  const sortie: Date[] = [];
  for (let l = lundiDe(premier); l.getTime() <= dernier.getTime(); l = plusJours(l, 7)) {
    if (moisDePaiementDeLaSemaine(l, finDeService) === mois) sortie.push(l);
  }
  return sortie;
}

/** Les jours qu'il faut lire pour payer le mois · du lundi de la première semaine au dimanche de la dernière. */
export function bornesDeLecture(mois: string, finDeService: Date | null): { du: Date; au: Date } | null {
  const semaines = semainesPayeesAuMois(mois, finDeService);
  if (semaines.length === 0) return null;
  return { du: semaines[0], au: plusJours(semaines[semaines.length - 1], 6) };
}

export type NatureMajorationHeures = 'HEURES_SUPPLEMENTAIRES' | 'TRAVAIL_DE_NUIT' | 'TRAVAIL_REPOS_OU_FERIE';

export type HeuresProposees = {
  /** La nature de la majoration déclarée qui paie ces heures. */
  nature: NatureMajorationHeures;
  /** Le libellé de ce qui est compté (« dont samedis » se distingue). */
  libelle: string;
  heures: number;
  /** Une partie n'a pas pu se compter (semaine incomplète) · la proposition est un minimum. */
  minimum: boolean;
};

export type TotauxDuMois = {
  heures: number;
  supplementaires: number;
  supplementairesIncompletes: boolean;
  nuit: number;
  samedi: number;
  dimanche: number;
  ferie: number;
};

/** LES HEURES À PROPOSER AU BULLETIN · proposées, jamais substituées, et un zéro ne se propose pas. */
export function heuresAProposer(semaines: readonly CompteDeLaSemaine[]): { totaux: TotauxDuMois; lignes: HeuresProposees[] } {
  const somme = (f: (s: CompteDeLaSemaine) => number) => enHeures(semaines.reduce((n, s) => n + enCentiemes(f(s)), 0));
  const incompletes = semaines.some((s) => s.supplementairesDeLaSemaine === null);
  const totaux: TotauxDuMois = {
    heures: somme((s) => s.heures),
    supplementaires: somme((s) => s.supplementairesDuJour + (s.supplementairesDeLaSemaine ?? 0)),
    supplementairesIncompletes: incompletes,
    nuit: somme((s) => s.heuresNuit),
    samedi: somme((s) => s.heuresSamedi),
    dimanche: somme((s) => s.heuresDimanche),
    ferie: somme((s) => s.heuresFerie),
  };
  const lignes: HeuresProposees[] = [];
  if (totaux.supplementaires > 0) {
    lignes.push({ nature: 'HEURES_SUPPLEMENTAIRES', libelle: 'Heures supplémentaires', heures: totaux.supplementaires, minimum: incompletes });
  }
  if (totaux.nuit > 0) lignes.push({ nature: 'TRAVAIL_DE_NUIT', libelle: 'Heures de nuit', heures: totaux.nuit, minimum: false });
  const reposEtFeries = enHeures(enCentiemes(totaux.dimanche) + enCentiemes(totaux.ferie));
  if (reposEtFeries > 0) {
    lignes.push({ nature: 'TRAVAIL_REPOS_OU_FERIE', libelle: 'Heures du dimanche et des jours fériés', heures: reposEtFeries, minimum: false });
  }
  // Le samedi est un jour OUVRABLE (Code du travail, art. 7, point 9) · son
  // supplément n'est payé que si la convention le prévoit (« éventuellement »,
  // mention 11). Ligne à part, que le cabinet retire s'il ne la doit pas.
  if (totaux.samedi > 0) {
    lignes.push({ nature: 'TRAVAIL_REPOS_OU_FERIE', libelle: 'Heures du samedi', heures: totaux.samedi, minimum: false });
  }
  return { totaux, lignes };
}

/**
 * LA FIN DU SERVICE · le dernier jour du dernier contrat, ou `null` tant
 * qu'un contrat est ouvert. Un contrat renouvelé enchaîne · seule la fin de la
 * chaîne compte.
 */
export function finDeService(contrats: readonly { dateEntreeEnVigueur: Date; dateFin: Date | null }[]): Date | null {
  if (contrats.length === 0) return null;
  if (contrats.some((c) => c.dateFin === null)) return null;
  return new Date(Math.max(...contrats.map((c) => (c.dateFin as Date).getTime())));
}

/** Le jour est-il couvert par un contrat ? */
export function sousContrat(jour: Date, contrats: readonly { dateEntreeEnVigueur: Date; dateFin: Date | null }[]): boolean {
  return contrats.some((c) => c.dateEntreeEnVigueur.getTime() <= jour.getTime() && (!c.dateFin || c.dateFin.getTime() >= jour.getTime()));
}
