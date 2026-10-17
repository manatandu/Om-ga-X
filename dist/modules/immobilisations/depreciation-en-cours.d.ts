export declare function estCompteDepreciationEnCours(numero: string): boolean;
export interface MouvementDepreciation {
    sens: 'DOTATION' | 'REPRISE';
    montant: number;
    compteDepreciationId: string;
}
export declare function cumulsParCompte29(depreciations: readonly MouvementDepreciation[]): Map<string, number>;
export declare function motifRefusCompte29DuBien(o: {
    syscohada: boolean;
    compteChoisi: {
        id: string;
        numero: string;
    };
    cumuls: ReadonlyMap<string, number>;
    numeros: ReadonlyMap<string, string>;
    inscritEnCours: boolean;
}): string | null;
