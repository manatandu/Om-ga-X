export type SensPiece = 'VENTE' | 'ACHAT';
export interface PieceDatee {
    sens: SensPiece;
    dateFacture: Date;
    dateReception: Date | null;
}
export declare function motifRefusDateReception(p: PieceDatee, aujourdhui: Date): string | null;
export declare function dateDeValeurComptable(p: PieceDatee): {
    date: Date;
} | {
    refus: string;
};
export declare function libelleDeFacture(nature: 'FACTURE' | 'NOTE_DE_CREDIT', numeroSerie: string, dateFacture: Date, contrepartieNom: string): string;
export declare function avertissementExerciceDeLaFacture(dateFacture: Date, dateEcriture: Date, exerciceDeLaFacture: {
    dateDebut: Date;
    dateFin: Date;
} | null): string | null;
