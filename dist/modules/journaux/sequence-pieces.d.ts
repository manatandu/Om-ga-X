import { NumerotationPiece } from '@prisma/client';
export type PerimetreSequence = 'JOURNAL_EXERCICE' | 'DOSSIER_EXERCICE' | 'JOURNAL_MOIS' | 'AUCUN';
export declare function perimetreDeLaSequence(numerotation: NumerotationPiece): PerimetreSequence;
export declare const EXPLICATION_PERIMETRE: Record<PerimetreSequence, string>;
export declare function trousDeLaSequence(numeros: number[]): Array<{
    de: number;
    a: number;
}>;
export declare function compterManquants(trous: Array<{
    de: number;
    a: number;
}>): number;
export declare function trousHorsNumerosRattaches(trous: Array<{
    de: number;
    a: number;
}>, ailleurs: Iterable<number>): {
    trous: Array<{
        de: number;
        a: number;
    }>;
    rattaches: number;
};
