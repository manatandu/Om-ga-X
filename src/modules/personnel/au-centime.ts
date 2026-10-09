/**
 * L'ARRONDI AU CENTIME DE LA PAIE, en un seul porteur.
 *
 * Au centime, comme la base garde les montants (Decimal 18,2). Il vivait dans
 * `decompte-final-emis.ts`, qui le réexporte · il descend ici, module SANS
 * IMPORT, parce que les assiettes (`assiettes-paie.ts`) en ont besoin pour le
 * plafond de l'art. 69, 1 (paquet 1, C1), et que `decompte-final-emis.ts`
 * dépend lui-même, par la passation, des assiettes · l'importer de là aurait
 * noué un cycle de modules.
 */
export const auCentime = (fc: number): number => Math.round(fc * 100) / 100;

/**
 * UN SEUIL DE LA PAIE SE JUGE EN CENTIMES ENTIERS (premier tour de relecture
 * du paquet 1, constat 1, jumeau de C1).
 *
 * Le flottant rend 131 072,30 × 30 / 100 = 39 321,689999999995, et une
 * indemnité de logement de 39 321,69 FC, exactement 30 % de la rémunération,
 * « dépassait » la condition de la loi n° 23/053, art. 69, 8, a) · tout le
 * logement devenait imposable. Cinq lignes qui font 559 000 FC s'additionnent
 * à 558 999,9999999999, sous le plancher de la CNSS ; 104 920,05 × 26 rend
 * 2 727 921,3000000003, au-dessus d'un contrat qui vaut exactement le minimum
 * de sa classe. Les montants de la paie sont des centimes (Decimal 18,2) · un
 * seuil se compare sur leurs centimes entiers, jamais sur la somme ou le
 * produit flottants. Même règle que le registre des avances
 * (`avances-salaire.ts`).
 */
export const enCentimes = (fc: number): number => Math.round(fc * 100);
