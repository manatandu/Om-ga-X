export declare const SEUIL_VERROUILLAGE = 5;
export declare const PALIERS_VERROU_MINUTES: readonly [1, 5, 15, 30, 60];
export declare const DELAI_OUBLI_ECHECS_HEURES = 12;
export declare function dureeVerrouMinutes(tentativesEchouees: number): number;
export declare function instantDeverrouillage(tentativesEchouees: number, maintenant: Date): Date | null;
export declare function decompteApresEchec(user: {
    tentativesEchouees: number;
    dernierEchecLe: Date | null;
}, maintenant: Date): {
    tentativesEchouees: number;
    verrouilleJusqua: Date | null;
    dernierEchecLe: Date;
};
export declare const DECOMPTE_REMIS_A_ZERO: {
    readonly tentativesEchouees: 0;
    readonly verrouilleJusqua: null;
    readonly dernierEchecLe: null;
};
export declare const MOTIF_IDENTIFIANTS_INVALIDES: string;
