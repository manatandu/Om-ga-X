export type Comportement = 'CHARGE_FIXE' | 'CHARGE_VARIABLE' | 'CHARGE_SEMI_VARIABLE' | 'PRODUIT_ACTIVITE' | 'HORS_CALCUL';
export declare const COMPORTEMENTS_DES_CHARGES: readonly Comportement[];
export declare const COMPORTEMENTS_DES_PRODUITS: readonly Comportement[];
export declare function motifRefusComportement(params: {
    numero: string;
    classe: string;
    comportement: Comportement | null;
    partVariablePct: number | null;
}): string | null;
export declare function partageFixeVariable(montant: number, comportement: 'CHARGE_FIXE' | 'CHARGE_VARIABLE' | 'CHARGE_SEMI_VARIABLE', partVariablePct: number | null): {
    fixe: number;
    variable: number;
};
