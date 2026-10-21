export declare class CreerTauxTvaDto {
    code: string;
    intitule: string;
    taux: number;
    compteCollecteId?: string;
    compteDeductibleId?: string;
}
export declare class ModifierTauxTvaDto {
    intitule?: string;
    taux?: number;
    compteCollecteId?: string | null;
    compteDeductibleId?: string | null;
    estActif?: boolean;
}
export declare class ComptabiliserLiquidationDto {
    exerciceId: string;
    dateDebut: string;
    dateFin: string;
    date?: string;
}
