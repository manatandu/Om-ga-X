import { LigneEcheancier } from './echeancier-location-acquisition';
export interface VentilationExercice {
    loyers: number;
    capital: number;
    interets: number;
    interetsCourus: number;
    rangs: number[];
    optionNonDeclaree: boolean;
    garantieNonDeclaree: boolean;
    garantieNonAppelee: number;
}
export declare function ventilerExercice(lignes: readonly LigneEcheancier[], datePriseEffet: Date, dette: number, tauxPeriodique: number, exercice: {
    dateDebut: Date;
    dateFin: Date;
}, optionLevee?: boolean | null, garantieAppelee?: boolean | null): VentilationExercice;
