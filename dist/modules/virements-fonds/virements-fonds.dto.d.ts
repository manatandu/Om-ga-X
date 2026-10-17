export declare class PieceOperationDto {
    nature?: unknown;
    reference?: unknown;
    date?: unknown;
}
export declare class CreerVirementDto {
    exerciceId: string;
    journalOrigineId: string;
    journalDestinationId: string;
    montant: number;
    sortie: PieceOperationDto;
    entree: PieceOperationDto;
    objet: string;
    porteur?: string;
    observations?: string;
}
export declare class AnnulerVirementDto {
    motif: string;
}
