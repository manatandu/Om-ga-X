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
