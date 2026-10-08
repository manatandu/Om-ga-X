/**
 * LES EXERCICES SE SUIVENT SANS INTERRUPTION (simulation du logiciel complet
 * du 2026-10-08, constat G3).
 *
 * « Le bilan d'ouverture d'un exercice doit correspondre au bilan de clôture
 * de l'exercice précédent » (AUDCIF art. 34 ; au SYCEBNL, son art. 16, 4°, l'art.
 * 34 étant exclu par son art. 3). Un dossier qui tenait 2026 et 2028 sans 2027
 * était admis, et la clôture de 2026 reportait ses soldes en 2028 · elle
 * prenait « le premier exercice qui commence après » au lieu de celui qui
 * commence le LENDEMAIN. Le report boucle, le bilan de 2028 aussi, et rien en
 * aval ne voit qu'une année manque. Deux portes le ferment · la création
 * refuse un exercice qui ne touche aucun autre, et chaque geste qui écrit dans
 * l'exercice suivant (clôture, report provisoire, affectation, budgets) refuse
 * un suivant qui n'est pas contigu, pour les dossiers nés avant la règle.
 */

const JOUR_MS = 86_400_000;

/** Le même jour calendaire, l'heure portée par la colonne ne comptant pas. */
function memeJour(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/** Un jour écrit JJ/MM/AAAA. */
function jour(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Le suivant est contigu quand il commence le lendemain de la fin. */
export function estContigu(dateFin: Date, debutSuivant: Date): boolean {
  return memeJour(new Date(dateFin.getTime() + JOUR_MS), debutSuivant);
}

/**
 * Le refus d'un geste qui écrirait dans un exercice NON contigu · il nomme le
 * trou et l'issue (créer l'exercice qui manque), jamais un contournement.
 */
export function motifSuivantNonContigu(dateFin: Date, suivant: { dateDebut: Date }): string {
  const lendemain = new Date(dateFin.getTime() + JOUR_MS);
  return (
    `Aucun exercice ne commence le ${jour(lendemain)}, lendemain de la clôture · le prochain exercice du dossier ` +
    `commence le ${jour(suivant.dateDebut)}. Le bilan d'ouverture d'un exercice doit correspondre au bilan de ` +
    "clôture de l'exercice précédent (AUDCIF art. 34 ; SYCEBNL art. 16, 4°) · créez d'abord l'exercice qui " +
    `commence le ${jour(lendemain)}.`
  );
}

/**
 * Le refus d'une création qui laisserait un trou · un exercice nouveau touche
 * le précédent (il commence le lendemain de sa fin) ou le suivant (il finit la
 * veille de son début).
 */
export function motifCreationNonContigue(
  dateDebut: Date,
  dateFin: Date,
  precedent: { dateFin: Date } | null,
  suivant: { dateDebut: Date } | null,
): string | null {
  // Aucun voisin hors de la période · les exercices existants la chevauchent,
  // ce que la règle d'unicité refuse déjà avec son propre motif.
  if (!precedent && !suivant) return null;
  if (precedent && estContigu(precedent.dateFin, dateDebut)) return null;
  if (suivant && estContigu(dateFin, suivant.dateDebut)) return null;
  const voisin = precedent
    ? `l'exercice précédent finit le ${jour(precedent.dateFin)}`
    : `l'exercice suivant commence le ${jour(suivant!.dateDebut)}`;
  return (
    `Cet exercice ne touche aucun exercice du dossier · ${voisin}. Les exercices se suivent sans interruption, ` +
    "le bilan d'ouverture de chacun correspondant au bilan de clôture du précédent (AUDCIF art. 34 ; SYCEBNL " +
    'art. 16, 4°) · créez d’abord les exercices intermédiaires.'
  );
}
