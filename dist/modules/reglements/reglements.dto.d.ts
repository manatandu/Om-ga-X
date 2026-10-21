export declare class PartFactureReglementDto {
    ligneId: string;
    montant: number;
}
export declare class ReglementTiersDto {
    compteId: string;
    ligneIds: string[];
    montant?: number;
    reference?: string;
    montantDevise?: number;
    coursReglement?: number;
    compteEcartChangeId?: string;
    imputation?: PartFactureReglementDto[];
    pieceImputation?: string;
    escompte?: number;
    solderEcart?: boolean;
    compteEscompteId?: string;
    compteEcartId?: string;
}
export declare class EnregistrerReglementsDto {
    sens: 'FOURNISSEUR' | 'CLIENT';
    exerciceId: string;
    journalId: string;
    date: string;
    reglements: ReglementTiersDto[];
    ordreVirement?: boolean;
    tresorerieEnDevise?: boolean;
    deviseTresorerieId?: string;
    modeReglementId?: string;
}
export declare class PasserEcartChangeDto {
    lettrageId: string;
    exerciceId: string;
    journalId: string;
    date: string;
    compteEcartChangeId?: string;
    reporterAuPremierJourOuvert?: boolean;
}
