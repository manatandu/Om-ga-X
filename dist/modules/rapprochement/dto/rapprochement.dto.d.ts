export declare class PropositionsRapprochementDto {
    fenetreJours?: number;
}
export declare class OuvrirRapprochementDto {
    compteId: string;
    dateReleve: string;
    soldeReleve: number;
}
export declare class PointerDto {
    ligneIds: string[];
}
export declare class ImporterReleveDto {
    nomFichier: string;
    contenuBase64: string;
    colonnes?: Record<string, string>;
}
export declare class CorrespondanceDto {
    ligneReleveId: string;
    ligneEcritureIds: string[];
    encoursIds?: string[];
}
export declare class ConfirmerCorrespondancesDto {
    correspondances: CorrespondanceDto[];
}
export declare class DeclarerDepartDto {
    soldeDepart: number;
    dateDepart: string;
}
export declare class DeclarerEncoursDto {
    libelle: string;
    date: string;
    montant: number;
    sens: 'DEBIT' | 'CREDIT';
}
export declare class PointerEncoursDto {
    encoursIds: string[];
}
export declare class RouvrirRapprochementDto {
    motif: string;
}
