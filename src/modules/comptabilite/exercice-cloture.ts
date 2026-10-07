import { Referentiel } from '@prisma/client';

/**
 * LE REFUS D'UN EXERCICE CLÔTURÉ NOMME L'ISSUE (cas chiffrés de la clôture,
 * constat N6, 2026-10-07).
 *
 * Le refus « Impossible d'enregistrer une écriture sur un exercice clôturé »
 * est juste, et il laissait le cabinet sans chemin · la charge de décembre
 * découverte après la clôture semblait ne pouvoir entrer nulle part, quand le
 * refus de la période close, lui, nomme l'art. 22, 4°. Le geste juste existe
 * et le texte le dit · la charge ou le produit omis passe par le compte de
 * résultat de l'exercice suivant ; deux exceptions seulement vont aux
 * capitaux propres d'ouverture (fenêtre Exercices,
 * `EcritureService.imputerAuxCapitauxPropresDOuverture`).
 *
 * Un message par référentiel, jamais l'un servi à l'autre (CLAUDE.md § 6) ·
 *  - SYSCOHADA · AUDCIF Titre V, correspondance bilan de clôture et bilan
 *    d'ouverture · « on ne peut imputer directement sur les capitaux propres
 *    ni les incidences des changements de méthode, ni les produits/charges
 *    d'exercices précédents omis (qui transitent par le compte de résultat).
 *    Deux seules exceptions [...] » ;
 *  - SYCEBNL · cadre conceptuel § 3.3.1.2.4 · « Ces corrections doivent
 *    transiter par le compte de résultat du nouvel exercice » (art. 16, 4) de
 *    l'Acte uniforme SYCEBNL pour la correspondance des bilans).
 */
export function motifExerciceCloture(referentiel: Referentiel): string {
  const source =
    referentiel === Referentiel.SYCEBNL
      ? 'SYCEBNL, cadre conceptuel § 3.3.1.2.4'
      : 'AUDCIF, Titre V, correspondance du bilan de clôture et du bilan d’ouverture';
  return (
    "Impossible d'enregistrer une écriture sur un exercice clôturé. Une charge ou un produit omis se passe " +
    "dans l'exercice ouvert suivant, par son compte de résultat ; seuls un changement de méthode à impact " +
    "fort significatif et la correction d'une erreur significative vont aux capitaux propres d'ouverture " +
    `(fenêtre Exercices) · ${source}.`
  );
}
