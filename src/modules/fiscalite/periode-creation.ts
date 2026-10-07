import { ENTREE_EN_VIGUEUR_LOI_23_053 } from '../../common/entree-en-vigueur-loi-23-053';

/**
 * LE PREMIER EXERCICE LONG ET SA PÉRIODE DE CRÉATION · loi n° 23/053, art. 12,
 * al. 3 (compilation DGI au 19/07/2026, lue le 2026-10-04), VERBATIM ·
 *
 *   « Les contribuables qui créent leurs entreprises postérieurement au 30 juin
 *   sont autorisés à arrêter leur premier exercice comptable le 31 décembre de
 *   l'année suivante. L'impôt est néanmoins établi sur les bénéfices réalisés
 *   au cours de la période allant du jour de la création de l'entreprise au
 *   31 décembre de la même année. Ces bénéfices sont déterminés d'après les
 *   comptes intermédiaires arrêtés à la date du 31 décembre de l'année de
 *   création de l'entreprise. Ils viennent ensuite en déduction des résultats
 *   du premier exercice comptable clos. »
 *
 * DEUX IMPOSITIONS POUR UN SEUL EXERCICE COMPTABLE. OmegaX traitait l'exercice
 * long comme une seule période imposable (cas chiffré C09,
 * `docs/cas-chiffres/is.md`) · créée le 1er septembre 2026, close le
 * 31 décembre 2027, la société payait 1 530 000 au lieu de 300 000 + 1 500 000,
 * le minimum de la période de création n'existant pas, et l'écran disait
 * « AUCUN acompte n'est dû » en 2027 alors que l'impôt de la période de
 * création EST l'impôt déclaré de l'exercice précédent qui fonde les acomptes
 * de 2027 (art. 57 bis LPF).
 *
 * CE QUE LE MODULE TIENT POUR LA DATE DE CRÉATION · l'ouverture du premier
 * exercice du dossier. Un dossier repris à un confrère dont le premier
 * exercice tenu ici serait long n'est pas ce cas · l'observation le dit.
 *
 * LE MINIMUM DE L'ART. 57 SUR LA PÉRIODE DE CRÉATION · tranché par la loi.
 * L'impôt « établi » sur cette période est l'Impôt sur les Sociétés, que le
 * chapitre 3 du Titre II liquide par l'art. 56 et l'art. 57 ; l'art. 57
 * assujettit « les sociétés » à l'impôt minimum « lorsque les résultats sont
 * déficitaires ou bénéficiaires mais susceptibles de donner lieu à une
 * imposition inférieure à ce montant », sans exception de période, et
 * l'art. 12, al. 3 n'en écarte aucune règle de liquidation. Le minimum joue
 * donc sur la période, au chiffre d'affaires de la période.
 *
 * LE CHIFFRE D'AFFAIRES DU MINIMUM DU PREMIER EXERCICE CLOS · tranché par la
 * loi le 2026-10-07 (`docs/decisions-par-la-loi-2026-10-07-bis.md`, point 2,
 * sources relues le 2026-10-07). C'est celui de l'année qui suit la création,
 * SANS celui de la période de création · le chiffre d'affaires de l'exercice
 * MOINS celui de la période (`chiffreAffairesMinimumPremierExercice`).
 *  1. L'impôt est ANNUEL · « établi chaque année sur les bénéfices réalisés
 *     l'exercice précédent » (art. 12, al. 1), « l'assiette de l'impôt dû au
 *     titre de ladite année » (al. 4) ; l'al. 3 découpe le premier exercice
 *     long en deux impositions, celle de la période, puis celle du premier
 *     exercice clos.
 *  2. Le chiffre d'affaires de l'art. 57 est « déclaré », et la déclaration
 *     est annuelle, souscrite « au plus tard le 30 avril de l'année qui suit
 *     celle de la réalisation des revenus » (LPF, art. 12), son relevé
 *     portant sur « les ventes réelles effectuées au cours de l'année de
 *     réalisation des revenus » (LPF, art. 13, al. 3 ; loi n° 23/053,
 *     art. 151) · celui de la période a porté son propre minimum dans la
 *     première déclaration. Le compter deux fois serait la double imposition
 *     d'un même élément que l'art. 55 écarte dans son principe.
 *  3. Pour une période de création de 2025, le minimum de la loi n° 23/053
 *     porterait sinon sur des ventes antérieures à son entrée en vigueur
 *     (art. 153 ; Constitution, art. 174, al. 1) · la même règle valant pour
 *     les deux cas (C09, C10), elle ne retient que l'année qui suit.
 * LA MÊME SOURCE QUE LA PÉRIODE · le chiffre d'affaires retranché est celui
 * qui a porté le minimum de la période, lu au livre-journal au 31 décembre de
 * l'année de création (un fait comptable, même quand le bénéfice de la
 * période est DÉCLARÉ) · ainsi chaque vente compte une fois et une seule.
 *
 * LA PERTE DE LA PÉRIODE DE CRÉATION · tranché par la loi le même jour. Elle
 * n'est ni déduite à part ni reportée à part · l'al. 3 ne fait venir en
 * déduction que « ces bénéfices », et l'art. 51 ne reporte que « les pertes
 * constatées au cours d'un exercice », or la période n'est pas un exercice
 * (le premier exercice comptable est l'exercice long). Elle reste dans « les
 * résultats du premier exercice comptable clos » et en diminue la base. Si
 * celui-ci est déficitaire, c'est SA perte qui se reporte (art. 51), son
 * caractère s'appréciant « par référence au résultat fiscal » (art. 52, 2°).
 * L'impôt minimum payé sur la période ne s'impute sur rien · les art. 51 et
 * 52 n'en prévoient pas l'imputation.
 */

export interface PeriodeCreation {
  /** Ouverture du premier exercice, tenue pour le jour de la création. */
  dateDebut: Date;
  /** Le 31 décembre de l'année de création · date des comptes intermédiaires. */
  dateFin: Date;
  annee: number;
  /**
   * La période de création tombe sous la loi n° 23/053 (année de création
   * 2026 ou après). Avant, ses bénéfices relèvent du texte qui régissait
   * l'année de création (art. 153), hors du corpus de calcul.
   */
  sousLaLoi: boolean;
}

/**
 * La période de création d'un exercice, si l'art. 12, al. 3 la commande ·
 * premier exercice du dossier, ouvert après le 30 juin d'une année et clos
 * le 31 décembre de l'année suivante. Null sinon.
 */
export function periodeDeCreation(
  exercice: { dateDebut: Date; dateFin: Date },
  premierExerciceDuDossier: boolean,
): PeriodeCreation | null {
  if (!premierExerciceDuDossier) return null;
  const annee = exercice.dateDebut.getUTCFullYear();
  // « Postérieurement au 30 juin » · le 1er juillet ou après (mois 6 en UTC).
  if (exercice.dateDebut.getUTCMonth() < 6) return null;
  const fin = exercice.dateFin;
  const closLe31DecembreSuivant =
    fin.getUTCFullYear() === annee + 1 && fin.getUTCMonth() === 11 && fin.getUTCDate() === 31;
  if (!closLe31DecembreSuivant) return null;
  const dateFin = new Date(Date.UTC(annee, 11, 31));
  return {
    dateDebut: exercice.dateDebut,
    dateFin,
    annee,
    sousLaLoi: new Date(Date.UTC(annee, 0, 1)).getTime() >= ENTREE_EN_VIGUEUR_LOI_23_053.getTime(),
  };
}

/**
 * Le bénéfice de la période qui vient « en déduction des résultats du premier
 * exercice comptable clos » · les BÉNÉFICES seuls (art. 12, al. 3, « ces
 * bénéfices »). Une perte n'est ni déduite ni reportée à part (art. 51, « les
 * pertes constatées au cours d'un exercice ») · elle reste dans le résultat du
 * premier exercice clos.
 */
export function deductionPeriodeCreation(resultatPeriode: number): number {
  return Math.max(resultatPeriode, 0);
}

/**
 * Le chiffre d'affaires du minimum (art. 57) du premier exercice clos · celui
 * de l'exercice MOINS celui de la période de création (décision par la loi du
 * 2026-10-07, point 2). Jamais négatif · une année qui suit la création dont
 * les avoirs dépasseraient les ventes n'a pas de chiffre d'affaires à imposer.
 */
export function chiffreAffairesMinimumPremierExercice(chiffreAffairesExercice: number, chiffreAffairesPeriode: number): number {
  return Math.max(0, Math.round((chiffreAffairesExercice - chiffreAffairesPeriode) * 100) / 100);
}

export const OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE =
  "CHIFFRE D'AFFAIRES DU MINIMUM DU PREMIER EXERCICE CLOS · l'impôt est établi chaque année (loi n° 23/053, art. 12, al. 1 et 4), et l'art. 12, al. 3 découpe le premier exercice long en deux impositions. Le minimum de l'art. 57, assis sur le chiffre d'affaires « déclaré », se calcule donc pour le premier exercice clos sur le chiffre d'affaires de l'année qui suit la création · celui de l'exercice MOINS celui de la période de création, qui a porté son propre minimum dans la déclaration de l'année de création (LPF, art. 12 et 13, al. 3 ; loi n° 23/053, art. 151). Le compter deux fois serait la double imposition que l'art. 55 écarte, et, pour une période de création antérieure au 1er janvier 2026, ferait porter le minimum sur des ventes d'avant l'entrée en vigueur de la loi (art. 153).";

/**
 * D'OÙ VIENT LE CHIFFRE D'AFFAIRES RETRANCHÉ (relecture du 2026-10-07,
 * mineur C09) · déclaré par le cabinet avec le bénéfice de la période, ou lu
 * au livre-journal au 31 décembre de l'année de création · et, bénéfice
 * déclaré sans son chiffre d'affaires, la lecture est dite.
 */
export function sourceChiffreAffairesPeriode(e: { chiffreAffairesDeclare: boolean; beneficeDeclare: boolean }): string {
  if (e.chiffreAffairesDeclare) return "Le chiffre d'affaires retranché est celui que le cabinet DÉCLARE pour la période, d'après ses comptes intermédiaires.";
  return (
    "Le chiffre d'affaires retranché est celui de la période, lu au livre-journal au 31 décembre de l'année de création" +
    (e.beneficeDeclare
      ? " · le bénéfice de la période est déclaré, son chiffre d'affaires ne l'est pas · déclarez-le s'il diffère de cette lecture."
      : '.')
  );
}

export const OBSERVATION_PERTE_PERIODE_CREATION =
  "PERTE DE LA PÉRIODE DE CRÉATION · elle n'est ni déduite ni reportée à part · l'art. 12, al. 3 ne fait venir en déduction que « ces bénéfices », et l'art. 51 ne reporte que « les pertes constatées au cours d'un exercice », la période n'en étant pas un. Elle reste dans les résultats du premier exercice clos et en diminue la base. Si celui-ci est déficitaire, c'est sa perte qui se reporte (art. 51), son caractère s'appréciant sur son résultat fiscal (art. 52, 2°) ; l'impôt minimum payé sur la période ne s'impute sur rien (art. 51 et 52).";
