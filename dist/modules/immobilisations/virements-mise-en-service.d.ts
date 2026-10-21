export interface VirementDeCompte {
    debit: number;
    credit: number;
}
export type VirementsParCompte = ReadonlyMap<string, VirementDeCompte>;
export declare const AUCUN_VIREMENT: VirementsParCompte;
export declare function virementsDesLignes(lignes: readonly {
    compteId: string;
}[], virements: VirementsParCompte): VirementDeCompte;
