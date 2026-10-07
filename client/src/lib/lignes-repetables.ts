import type { LigneNoteCalculee } from './types';

/**
 * RUBRIQUES RÉPÉTABLES (une ligne par apporteur, par entité, par produit) ·
 * le serveur rend une ligne par occurrence saisie, avec son `rang`. L'écran
 * ajoute, après la dernière, les lignes vides demandées puis le bouton
 * « Ajouter une ligne ». Le rang d'une ligne ajoutée suit le plus grand rang
 * servi · rien n'est écrit tant qu'aucune cellule n'est remplie.
 */
export function lignesAvecAjouts(
  lignes: LigneNoteCalculee[],
  nbColonnes: number,
  ajoutees: Record<string, number>,
): Array<LigneNoteCalculee | { ajouterApres: string }> {
  const resultat: Array<LigneNoteCalculee | { ajouterApres: string }> = [];
  lignes.forEach((l, i) => {
    resultat.push(l);
    const repetable = l.cle !== undefined && l.rang !== undefined && l.saisie !== undefined;
    const derniere = repetable && lignes[i + 1]?.cle !== l.cle;
    if (!derniere) return;
    const maxRang = Math.max(...lignes.filter((x) => x.cle === l.cle).map((x) => x.rang ?? 0));
    for (let k = 1; k <= (ajoutees[l.cle!] ?? 0); k++) {
      resultat.push({
        ...l,
        rang: maxRang + k,
        saisie: Array.from({ length: nbColonnes }, () => null),
        ecartsSaisie: undefined,
      } as LigneNoteCalculee);
    }
    resultat.push({ ajouterApres: l.cle! });
  });
  return resultat;
}
