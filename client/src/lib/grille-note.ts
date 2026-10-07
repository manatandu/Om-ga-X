/**
 * LA GRILLE D'UN TABLEAU DE NOTE ANNEXE · une seule pour l'en-tête et les
 * lignes · deux gabarits différents (108 px d'un côté, 1fr de l'autre)
 * faisaient glisser les seize colonnes M / F des notes 20B et 29B, et un M se
 * saisissait sous l'en-tête F.
 *
 * LA PREMIÈRE PISTE A UN MINIMUM FIXE (relecture 2) · un `1.6fr` nu a pour
 * minimum `auto`, qui se réduit au mot le plus long de CHAQUE ligne · mesuré
 * dans Chromium, l'en-tête et les lignes glissaient encore jusqu'à 27 px.
 */
export const gabaritGrilleNote = (nbColonnes: number) =>
  `minmax(11rem, 1.6fr) repeat(${nbColonnes}, minmax(108px, 1fr))`;
