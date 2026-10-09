/**
 * AU2 · CE QUE L'ÉCRAN DIT DE L'OUVERTURE DÉJÀ PASSÉE DANS L'EXERCICE SUIVANT,
 * lu sur l'aperçu servi par `GET /exercices/:id/ouverture-suivante`, jamais
 * recalculé ici.
 *
 * SECOND TOUR DE RELECTURE DU PAQUET 1, BLOQUANT 1. Une ouverture annulée par
 * un négatif inscrit HORS du premier jour se solde à zéro, et l'écran disait
 * « soldées à zéro · le report entier sera passé » · or la position exacte a
 * pu être ressaisie le jour du négatif, et le report passé par-dessus compte
 * l'ouverture deux fois. Le serveur fait déclarer (`declarationRequise`) et
 * nomme les négatifs (`negatifsTardifs`) · l'écran ne promet plus le report
 * entier, et ses deux choix disent ce qui se passe dans CE cas (AUDCIF
 * art. 20, al. 2 ; art. 34 · SYCEBNL art. 16, 4)).
 */
export interface ApercuOuverture {
  pieces: string | null;
  auBrouillard: boolean;
  ouvertureNulle: boolean;
  exerciceSansEcriture: boolean;
  declarationRequise: boolean;
  total: number;
  /** Absent d'un serveur antérieur au second tour. */
  negatifsTardifs?: { piece: string; date: string }[];
}

/** « OD n° 2 du 15/03/2027 » · les négatifs inscrits hors du premier jour, cinq au plus. */
export function negatifsTardifsLisibles(n: readonly { piece: string; date: string }[]): string {
  const jour = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return n.slice(0, 5).map((t) => `${t.piece} du ${jour(t.date)}`).join(', ') + (n.length > 5 ? ` et ${n.length - 5} autre(s)` : '');
}

/** L'ouverture est-elle annulée par un négatif inscrit hors du premier jour ? */
export function annuleeHorsDuPremierJour(o: ApercuOuverture): boolean {
  return o.ouvertureNulle && (o.negatifsTardifs?.length ?? 0) > 0;
}

/**
 * La ligne dite quand aucune déclaration n'est demandée · `null` s'il n'y a
 * rien à dire (aucune ouverture, brouillard, ou déclaration à faire).
 */
export function issueSansDeclaration(o: ApercuOuverture): string | null {
  if (!o.pieces || o.auBrouillard || o.declarationRequise) return null;
  if (o.ouvertureNulle) {
    return annuleeHorsDuPremierJour(o)
      ? `Écritures du premier jour de l'exercice suivant (${o.pieces}) annulées après le premier jour (${negatifsTardifsLisibles(o.negatifsTardifs ?? [])}) · cet exercice n'a rien à reporter.`
      : `Écritures du premier jour de l'exercice suivant (${o.pieces}) soldées à zéro · le report entier sera passé.`;
  }
  return o.total === 0
    ? `Ouverture déjà passée dans l'exercice suivant (${o.pieces}) · concordante, aucun report ne sera ajouté.`
    : `Ouverture déjà passée dans l'exercice suivant (${o.pieces}) · cet exercice n'a aucune écriture, elle fait foi.`;
}

/** Le titre du cadre de déclaration. */
export function titreDeclaration(o: ApercuOuverture | null): string {
  if (!o) return "Ouverture de l'exercice suivant";
  if (annuleeHorsDuPremierJour(o)) {
    return `Ouverture du premier jour (${o.pieces}) annulée après le premier jour (${negatifsTardifsLisibles(o.negatifsTardifs ?? [])})`;
  }
  return `Ouverture déjà passée (${o.pieces}) différente du bilan de clôture`;
}

/** Les libellés des deux choix · ce qu'ils font dans le cas servi. */
export function libellesChoix(o: ApercuOuverture | null): { rectifier: string; conserver: string } {
  if (o && annuleeHorsDuPremierJour(o)) {
    return {
      rectifier: "Rectifier · l'ouverture n'a pas été ressaisie (le report entier est passé)",
      conserver: "Conserver · l'ouverture exacte a été ressaisie après le premier jour (rien n'est passé)",
    };
  }
  return {
    rectifier: "Rectifier l'import (les livres de cet exercice sont dans OmegaX)",
    conserver: "Conserver l'import (exercice tenu ici pour les comparatifs)",
  };
}
