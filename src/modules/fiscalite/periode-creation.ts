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
 * L'ART. 55 (« Les éléments déjà imposés au cours d'un exercice sont déduits
 * du montant des revenus imposables […] en vue d'éviter la double imposition
 * d'un même revenu ») conforte la déduction des BÉNÉFICES de la période ; il
 * ne dit rien du chiffre d'affaires.
 *
 * CE QUE LE TEXTE NE DIT PAS, ET QUI N'EST PAS CODÉ · le chiffre d'affaires du
 * minimum du premier exercice clos. L'art. 12, al. 3 ne fait déduire que les
 * BÉNÉFICES de la période de création, pas son chiffre d'affaires ; le module
 * garde donc le chiffre d'affaires de l'exercice entier (lecture littérale,
 * celle d'avant) et le dit (`OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE`).
 * Une perte de la période de création n'est pas davantage visée (« ces
 * bénéfices ») · elle reste dans le résultat du premier exercice clos.
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
 * exercice comptable clos » · les BÉNÉFICES seuls, une perte n'est pas visée
 * par l'art. 12, al. 3 et reste dans le résultat de l'exercice.
 */
export function deductionPeriodeCreation(resultatPeriode: number): number {
  return Math.max(resultatPeriode, 0);
}

export const OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE =
  "Art. 12, al. 3 : seuls les BÉNÉFICES de la période de création viennent en déduction du premier exercice clos · le texte ne dit rien de son chiffre d'affaires. Le minimum de l'art. 57 du premier exercice clos est donc calculé sur le chiffre d'affaires de l'exercice ENTIER, période de création comprise, qui a déjà porté son propre minimum. L'art. 55 déduit « les éléments déjà imposés au cours d'un exercice […] du montant des revenus imposables » pour éviter la double imposition d'un même revenu · il vise les REVENUS imposables, non le chiffre d'affaires qui assied le minimum, et ne tranche donc pas davantage. Lecture littérale, que le texte ne tranche pas · à faire confirmer avant la déclaration si le minimum est retenu.";
