/**
 * LES SÉQUENCES DE SAISIE (ligne sage-l1, fonction 19 · Sage 100, Structure
 * des fichiers, table P_SEQUENCE, p. 558 et 559 · « Séquence de saisie »,
 * SQ_Sequence01 à SQ_Sequence10, intitulé de 35 caractères au plus ; chaque
 * élément à saisir porte la sienne, N_Sequence, de 0 = aucune à 10).
 *
 * LA LECTURE RETENUE (la plus fidèle que la ligne puisse tenir) · chez Sage,
 * la table est celle de la Paie Maestria, et ses éléments sont les rubriques
 * du bulletin (F_RUBRIQUE.N_Sequence) · la saisie se fait par séquence. La
 * reproduction (architecture, ligne 19) la range dans Structure > Paramètres
 * de saisie, avec les MODÈLES DE SAISIE, qui sont à la saisie des journaux
 * ce que les rubriques sont au bulletin · dix séquences nommées par dossier,
 * chaque modèle dans une séquence ou aucune, et la saisie (F4) propose les
 * modèles d'une séquence. Les rubriques de paie relèvent du module du
 * personnel, tenu par une autre ligne · leur rangement par séquence n'est pas
 * fait ici, et c'est dit au compte rendu.
 *
 * Aucun texte ne régit le geste · c'est l'organisation de la saisie.
 */
export const NOMBRE_MAX_SEQUENCES = 10;
export const LONGUEUR_MAX_INTITULE_SEQUENCE = 35;

/** Le premier rang libre de 1 à 10, ou null quand les dix sont pris. */
export function premierRangLibre(pris: Iterable<number>): number | null {
  const occupes = new Set(pris);
  for (let n = 1; n <= NOMBRE_MAX_SEQUENCES; n++) if (!occupes.has(n)) return n;
  return null;
}

/** Le refus d'un intitulé, ou null · non vide, 35 caractères au plus (Sage). */
export function motifRefusIntituleSequence(intitule: string): string | null {
  const t = intitule.trim();
  if (!t) return "L'intitulé de la séquence est obligatoire.";
  if (t.length > LONGUEUR_MAX_INTITULE_SEQUENCE) {
    return `L'intitulé d'une séquence tient en ${LONGUEUR_MAX_INTITULE_SEQUENCE} caractères au plus (${t.length} tapés).`;
  }
  return null;
}

export const MOTIF_DIX_SEQUENCES =
  `Le dossier compte déjà ${NOMBRE_MAX_SEQUENCES} séquences de saisie, le nombre maximal · renommez-en une, ou ` +
  "retirez celle qui ne sert plus.";

/** Le refus du retrait d'une séquence qui range encore des modèles. */
export function motifSequenceOccupee(intitule: string, nombreModeles: number): string {
  return (
    `La séquence « ${intitule} » range ${nombreModeles} modèle(s) de saisie · retirez-les d'abord de la séquence ` +
    '(Modèles de saisie), ou renommez-la.'
  );
}
