export type FondementVentilation = 'ACTE' | 'VALEURS_ATTRIBUABLES' | 'COMPARAISON_TERRAINS_NUS' | 'COUT_RECONSTRUCTION' | 'PRIX_DE_MARCHE' | 'FORFAIT';
export declare const LIBELLE_FONDEMENT: Record<FondementVentilation, string>;
export interface ElementAVentiler {
    numeroCompte: string;
    montant?: number | null;
    parDifference?: boolean;
}
export declare function ventilerPrixGlobal(o: {
    prix: number;
    fondement: FondementVentilation;
    elements: readonly ElementAVentiler[];
    motifSansComparaison?: string | null;
}): {
    montants: number[];
} | {
    motif: string;
};
export declare function ventilerFondsDeCommerce(o: {
    referentiel: 'SYSCOHADA' | 'SYCEBNL';
    prix: number;
    elements: readonly {
        numeroCompte: string;
        montant: number;
    }[];
    stocks: readonly {
        numeroCompte: string;
        montant: number;
    }[];
}): {
    fondsCommercial: number;
} | {
    motif: string;
};
