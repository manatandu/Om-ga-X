export declare class LigneLotDto {
    compteId: string;
    montant: number;
}
export declare class LotVirementDto {
    nom: string;
    journalId?: string | null;
    lignes: LigneLotDto[];
}
