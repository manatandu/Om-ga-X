export declare function plafondRepriseDepreciation(o: {
    cumulDepreciation: number;
    valeurNette: number;
    valeurSansDepreciation: number;
}): number;
export declare function motifRefusRepriseDepreciation(o: {
    montant: number;
    cumulDepreciation: number;
    valeurNette: number;
    valeurSansDepreciation: number;
}): string | null;
