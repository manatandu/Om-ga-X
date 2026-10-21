export declare class LigneOdAnalytiqueDto {
    sectionId: string;
    debit?: number;
    credit?: number;
}
export declare class CreerOdAnalytiqueDto {
    exerciceId: string;
    planId: string;
    compteId: string;
    date: string;
    reference?: string;
    libelle: string;
    lignes: LigneOdAnalytiqueDto[];
}
