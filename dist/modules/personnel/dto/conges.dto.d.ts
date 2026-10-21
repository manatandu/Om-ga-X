export declare class RepriseCongesDto {
    arreteAu: string;
    joursNesNonPris: number;
    moisEnCoursAccomplis: number;
    source: string;
}
export declare class AllocationCongeDto {
    deviseAllocation?: 'CDF' | 'USD';
    remunerationJournaliere?: number;
    moyenneMensuelleArticle142?: number;
}
export declare class CongeSalarieDto extends AllocationCongeDto {
    du: string;
    au: string;
    joursVoyage?: number;
    moisDePaie: string;
    auDelaDuSolde?: boolean;
    motifAuDelaDuSolde?: string;
}
export declare class AnnulationCongeDto {
    motif: string;
}
