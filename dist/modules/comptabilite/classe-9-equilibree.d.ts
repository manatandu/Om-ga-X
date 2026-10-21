import { Referentiel } from '@prisma/client';
export declare const RACINES_HORS_BILAN: readonly ["90", "91"];
export declare function ecartClasse9(lignes: Array<{
    numero: string;
    debit?: number;
    credit?: number;
}>): number;
export declare function motifRefusClasse9(referentiel: Referentiel, ecart: number): string | null;
