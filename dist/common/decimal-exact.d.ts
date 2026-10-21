export type DecimalExact = {
    readonly mantisse: bigint;
    readonly echelle: number;
};
export declare const ZERO: DecimalExact;
export declare function depuisNombre(x: number): DecimalExact;
export declare function exact(x: number | DecimalExact): DecimalExact;
export declare function plus(a: DecimalExact, b: DecimalExact): DecimalExact;
export declare function moins(a: DecimalExact, b: DecimalExact): DecimalExact;
export declare function somme(valeurs: readonly DecimalExact[]): DecimalExact;
export declare function fois(a: DecimalExact, b: DecimalExact): DecimalExact;
export declare function pourCent(a: DecimalExact, tauxPourCent: DecimalExact): DecimalExact;
export declare function foisEntier(a: DecimalExact, n: number): DecimalExact;
export declare function comparer(a: DecimalExact, b: DecimalExact): -1 | 0 | 1;
export declare function maximum(a: DecimalExact, b: DecimalExact): DecimalExact;
export declare function plancherAuMultiple(a: DecimalExact, pas: number): number;
export declare function centimesLoinDeZero(a: DecimalExact): bigint;
export declare function versChaine(a: DecimalExact): string;
export declare function versNombre(a: DecimalExact): number;
