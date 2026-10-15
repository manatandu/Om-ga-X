/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · LES HEURES MAJORÉES (décision D8,
 * `docs/comparaison-sage/reproduction/architecture.md`). Moteur pur.
 *
 * AUCUN TAUX N'EST AU CORPUS. Code du travail, art. 119, al. 4 · « Les heures
 * effectuées au-delà de la durée légale du travail sont considérées comme
 * heures supplémentaires et donnent droit à une majoration de salaire. »
 * Art. 120, e) · « les modalités de rémunération des heures supplémentaires »
 * sont fixées par arrêté du Ministre, « par branche d'activité économique et
 * par catégorie professionnelle ». Art. 124 · le travail de nuit, « entre 19
 * heures et 5 heures », « doit être payé avec majoration, sans préjudice des
 * dispositions relatives au paiement des heures supplémentaires », ses
 * modalités par arrêté. Ces arrêtés ne sont pas au corpus · le taux se
 * DÉCLARE par le cabinet, avec sa source (convention collective, règlement
 * d'entreprise, arrêté), jamais deviné. Le livre de paie porte « le nombre
 * d'heures supplémentaires prestées », « les taux auxquels sont payées les
 * heures supplémentaires » et « les suppléments éventuellement payés pour le
 * travail du samedi, du dimanche et des jours fériés légaux » (arrêté
 * n° 12/CAB.MIN/ETPS/042 du 8 août 2008, mentions 8 à 11).
 *
 * L'HEURE SUPPLÉMENTAIRE SE PAIE ENTIÈRE, MAJORÉE · elle est au-delà de la
 * durée que le salaire convenu rémunère, et la rémunération est due « pour le
 * temps où le travailleur a effectivement fourni ses services » (art. 93) ·
 * heures × taux horaire × (1 + majoration). L'heure de nuit, du samedi, du
 * dimanche ou d'un férié faite dans l'horaire normal est déjà payée par le
 * salaire · seul le SUPPLÉMENT s'ajoute, heures × taux horaire × majoration.
 * Une heure de nuit qui est aussi supplémentaire porte les deux lignes
 * (art. 124, « sans préjudice »).
 *
 * LE TAUX HORAIRE SE DÉCLARE AUSSI · le Code fixe quarante-cinq heures par
 * semaine ET huit heures par jour (art. 119, al. 1), deux conversions d'un
 * salaire au mois en heures qui ne donnent pas le même taux, et le décret
 * n° 25/22 n'en écrit aucune (son art. 7 ne passe du jour qu'à la semaine, au
 * mois et à l'année, « en multipliant par 6, 26 et 312 »). Le contrat ou la
 * convention le fixe ; OmegaX ne le devine pas.
 *
 * Le nombre d'heures supplémentaires autorisées (art. 120, b) relève du même
 * arrêté absent · aucun plafond n'est opposé, et c'est dit.
 */

export type NatureMajoration = 'HEURES_SUPPLEMENTAIRES' | 'TRAVAIL_DE_NUIT' | 'TRAVAIL_REPOS_OU_FERIE';

export type DefinitionMajoration = {
  readonly libelle: string;
  readonly fondement: string;
  /** L'heure se paie entière (heure supplémentaire) ou seul le supplément s'ajoute. */
  readonly heureEntiere: boolean;
};

export const NATURES_MAJORATION: Readonly<Record<NatureMajoration, DefinitionMajoration>> = {
  HEURES_SUPPLEMENTAIRES: {
    libelle: 'Heures supplémentaires',
    fondement: 'Code du travail, art. 93, 119 et 120, e)',
    heureEntiere: true,
  },
  TRAVAIL_DE_NUIT: {
    libelle: 'Travail de nuit',
    fondement: 'Code du travail, art. 124',
    heureEntiere: false,
  },
  TRAVAIL_REPOS_OU_FERIE: {
    libelle: "Travail du samedi, du dimanche ou d'un jour férié",
    fondement: 'Arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, mention 11',
    heureEntiere: false,
  },
};

/** Au-delà, une majoration se lit comme une faute de frappe (mille pour cent). */
export const TAUX_MAJORATION_AU_PLUS = 1_000;
/** Les heures d'un mois · trente et un jours de vingt-quatre heures. */
export const HEURES_DU_MOIS_AU_PLUS = 744;

export function motifRefusMajoration(p: { nature: string; libelle: string; tauxPourCent: number; source: string; dateEffet: string }): string | null {
  if (!(p.nature in NATURES_MAJORATION)) return 'Nature de majoration inconnue.';
  if (p.libelle.trim().length < 3) return 'La majoration se nomme (trois caractères au moins).';
  if (!Number.isFinite(p.tauxPourCent) || p.tauxPourCent <= 0 || p.tauxPourCent > TAUX_MAJORATION_AU_PLUS) {
    return `Le taux de majoration est un pourcentage strictement positif, ${TAUX_MAJORATION_AU_PLUS} au plus.`;
  }
  if (p.source.trim().length < 3) {
    return "La source du taux se déclare · convention collective, règlement d'entreprise ou arrêté (Code du travail, art. 120, e) et 124).";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateEffet.slice(0, 10))) return "La date d'effet se lit AAAA-MM-JJ.";
  return null;
}

/** Le montant des heures d'une ligne, au centime. */
export function montantDesHeures(p: { nature: NatureMajoration; heures: number; tauxHoraire: number; tauxPourCent: number }): number {
  const def = NATURES_MAJORATION[p.nature];
  const facteur = def.heureEntiere ? 1 + p.tauxPourCent / 100 : p.tauxPourCent / 100;
  return Math.round(p.heures * p.tauxHoraire * facteur * 100) / 100;
}

const nombre = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Le libellé de l'élément de paie · il dit les heures, le taux horaire et la majoration (mentions 8 à 11). */
export function libelleDesHeures(p: { nature: NatureMajoration; heures: number; tauxHoraire: number; tauxPourCent: number; libelleMajoration: string }): string {
  const def = NATURES_MAJORATION[p.nature];
  const facon = def.heureEntiere ? `majorées de ${nombre(p.tauxPourCent)} %` : `supplément de ${nombre(p.tauxPourCent)} %`;
  return `${p.libelleMajoration} · ${nombre(p.heures)} h au taux horaire de ${nombre(p.tauxHoraire)}, ${facon}`;
}
