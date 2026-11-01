import type { SpecificationNote } from './note-annexe.types';

/**
 * LA RUBRIQUE DE CHAQUE LIGNE SERVIE, ET LA LIGNE DE CHAQUE RUBRIQUE (ligne
 * origine-des-montants, relecture du 2026-11-01, mineur 3).
 *
 * Une note servie retire ses lignes non chiffrées (§ 1.4) · le rang d'une
 * ligne n'est donc pas celui de sa rubrique. Une rubrique à CLÉ se retrouve
 * par sa clé. Sans clé, le libellé ne suffit pas · « Intérêts courus » est
 * deux fois dans la note 18A des associations et dans la note 11 des projets.
 * L'ordre des rubriques est conservé par la note servie · quand toutes les
 * rubriques d'un même libellé y sont, la k-ième ligne est la k-ième rubrique.
 * Quand une partie seulement y est, rien ne dit laquelle · l'appariement est
 * AMBIGU, et l'origine le refuse plutôt que de montrer les comptes d'une
 * autre rubrique.
 */
export type Appariement = number | 'ambigu';

export function apparierRubriques(
  spec: SpecificationNote,
  lignes: ReadonlyArray<{ cle?: string; libelle: string }>,
): { rubriqueDeLigne: Map<number, Appariement>; ligneDeRubrique: Map<number, Appariement> } {
  const rubriqueDeLigne = new Map<number, Appariement>();
  const ligneDeRubrique = new Map<number, Appariement>();
  spec.rubriques.forEach((r, i) => {
    if (!r.cle) return;
    const rang = lignes.findIndex((l) => l.cle === r.cle);
    if (rang < 0) return;
    ligneDeRubrique.set(i, rang);
    lignes.forEach((l, j) => l.cle === r.cle && rubriqueDeLigne.set(j, i));
  });
  const libelles = new Set(spec.rubriques.filter((r) => !r.cle).map((r) => r.libelle));
  for (const libelle of libelles) {
    const rubriques = spec.rubriques.flatMap((r, i) => (!r.cle && r.libelle === libelle ? [i] : []));
    const servies = lignes.flatMap((l, j) => (!l.cle && l.libelle === libelle ? [j] : []));
    if (servies.length === 0) continue;
    if (servies.length === rubriques.length) {
      rubriques.forEach((i, k) => {
        ligneDeRubrique.set(i, servies[k]);
        rubriqueDeLigne.set(servies[k], i);
      });
      continue;
    }
    for (const i of rubriques) ligneDeRubrique.set(i, 'ambigu');
    for (const j of servies) rubriqueDeLigne.set(j, 'ambigu');
  }
  return { rubriqueDeLigne, ligneDeRubrique };
}

export const motifRubriqueAmbigue = (libelle: string, code: string) =>
  `La rubrique « ${libelle} » de la note ${code} porte le même libellé qu'une autre, et une seule des deux est servie · ` +
  "l'origine ne se rattache pas sans risque de montrer les comptes de l'autre.";
