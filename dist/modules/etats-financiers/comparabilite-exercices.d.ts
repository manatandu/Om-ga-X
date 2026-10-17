import { Referentiel } from '@prisma/client';
export type CodeNonComparabilite = 'DUREE_DIFFERENTE';
export interface MotifNonComparabilite {
    code: CodeNonComparabilite;
    phrase: string;
}
export interface Comparabilite {
    disponible: boolean;
    comparable: boolean;
    motifs: MotifNonComparabilite[];
    article: string;
}
export interface BorneExercice {
    dateDebut: Date;
    dateFin: Date;
}
export declare function moisCouverts(borne: BorneExercice): number;
export declare function articleComparabilite(referentiel: Referentiel): string;
export declare function evaluerComparabilite(referentiel: Referentiel, courant: BorneExercice, precedent: BorneExercice | null): Comparabilite;
