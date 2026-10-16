/**
 * UN GESTE, PUIS LA RELECTURE DE LA LISTE, CHACUN SON ISSUE (relecture
 * « échecs silencieux » de la ligne sage-l2, m6). La relecture se faisait
 * dans le même `try` que le geste · un geste ENREGISTRÉ dont la relecture
 * échouait était dit en échec, et l'écran rétablissait la valeur d'avant
 * qu'il venait pourtant de remplacer au serveur. Le geste réussi le reste ;
 * la relecture manquée se dit à part, avec ce qu'elle implique.
 */
export interface IssueDuGeste {
  /** Le geste est enregistré au serveur. */
  fait: boolean;
  /** Le refus du geste, à dire comme une erreur. */
  erreurGeste: string | null;
  /** La relecture manquée après un geste réussi, à dire à part. */
  erreurRelecture: string | null;
}

export async function gestePuisRelecture(
  geste: () => Promise<unknown>,
  relire: () => Promise<unknown>,
  messageDe: (e: unknown) => string | null,
): Promise<IssueDuGeste> {
  try {
    await geste();
  } catch (e) {
    return { fait: false, erreurGeste: messageDe(e) ?? 'Action impossible', erreurRelecture: null };
  }
  try {
    await relire();
    return { fait: true, erreurGeste: null, erreurRelecture: null };
  } catch (e) {
    return { fait: true, erreurGeste: null, erreurRelecture: messageDe(e) ?? 'serveur injoignable' };
  }
}

/** Ce que dit une relecture manquée · le geste est passé, la liste montrée peut ne pas le montrer. */
export function avisRelectureManquee(liste: string, motif: string): string {
  return `Enregistré · ${liste} n'a pas pu être relue (${motif}) · elle peut ne pas montrer ce geste, rouvrez la fenêtre pour la relire.`;
}
