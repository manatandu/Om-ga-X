export declare class PartDeclareeDto {
    deviseId: string;
    montantDevise: number;
    coursApplique?: number;
    montant: number;
}
export declare class DeclarerDeviseANouveauDto {
    ligneId: string;
    parts: PartDeclareeDto[];
    source: string;
}
