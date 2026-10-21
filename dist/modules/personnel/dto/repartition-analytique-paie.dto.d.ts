export declare class LigneRepartitionAnalytiqueDto {
    sectionId: string;
    pourcentage: number;
}
export declare class RepartitionAnalytiquePaieDto {
    planId: string;
    moisEffet: string;
    lignes: LigneRepartitionAnalytiqueDto[];
}
export declare class RetraitRepartitionAnalytiqueDto {
    motif: string;
}
