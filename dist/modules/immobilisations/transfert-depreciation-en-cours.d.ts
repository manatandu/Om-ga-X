export type ReferentielTransfert = 'SYSCOHADA' | 'SYCEBNL';
export type NiveauDepreciation = 'EXPLOITATION' | 'HAO';
export interface MouvementLu {
    sens: 'DOTATION' | 'REPRISE';
    montant: number;
    compteDepreciationId: string;
    numeroCompteDepreciation: string;
    numeroContrepartie: string;
    montantImputeEcart: number;
}
export type PropositionTransfert = {
    etat: 'SANS_OBJET';
} | {
    etat: 'ABSTENTION';
    motif: string;
} | {
    etat: 'A_PASSER';
    montant: number;
    compteSourceId: string;
    numeroSource: string;
    niveau: NiveauDepreciation;
    numeroReprise: string;
    numeroDotation: string;
    racineCible: string;
};
export declare function racine29DuCompteDefinitif(numeroDefinitif: string): string;
export declare function propositionTransfert(o: {
    smt: boolean;
    numeroCompteDefinitif: string;
    mouvements: readonly MouvementLu[];
}): PropositionTransfert;
export declare function motifRefusCompteCible(numeroCible: string, racineCible: string): string | null;
export declare function compteCiblePropose<T extends {
    numero: string;
}>(racineCible: string, candidats: readonly T[]): T | null;
export declare function porteurDeLaDepreciation<M extends {
    sens: 'DOTATION' | 'REPRISE';
    montant: number;
    compteDepreciationId: string;
    compteContrepartieId: string;
}>(mouvements: readonly M[]): {
    compteDepreciationId: string;
    compteContrepartieDotationId: string | null;
} | null;
export declare function dernierTestDeClotureDepuis(mouvements: readonly {
    nature: string;
    exercice: {
        dateFin: Date;
    };
    compteDepreciation: {
        numero: string;
    };
}[], date: Date): Date | null;
export declare function motifTransfertDiffere(numeroSource: string, montant: number, dernierTest: Date): string;
