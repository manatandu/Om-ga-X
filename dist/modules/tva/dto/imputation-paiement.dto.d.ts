export declare class FactureImputeeDto {
    ligneFactureId: string;
    montant: number;
}
export declare class DeclarerImputationDto {
    ligneReglementId: string;
    fondement: 'DECLARATION_DU_DEBITEUR' | 'QUITTANCE_ACCEPTEE';
    pieceReference: string;
    pieceDate: string;
    preuveAcceptation?: string;
    factures: FactureImputeeDto[];
}
export declare class RetirerImputationDto {
    motif: string;
}
