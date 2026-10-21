export declare const DECLARATION_METHODES_IDENTIQUES: string;
export declare const RESERVE_JEU_INCOMPLET: string;
export interface BornesExercice {
    dateDebut: Date;
    dateFin: Date;
}
export declare function motifRefusDateArrete(arreteAu: Date, exercice: BornesExercice): string | null;
export declare function memePeriodeExercicePrecedent(arreteAu: Date, exerciceN1: BornesExercice | null): Date | null;
export declare function finDeJournee(date: Date): Date;
