export declare class LigneAffectationDto {
    compteId: string;
    montant: number;
    libelle?: string;
}
export declare class EnregistrerAffectationDto {
    exerciceId: string;
    dateDecision: string;
    organe: string;
    reference?: string;
    lignes: LigneAffectationDto[];
}
