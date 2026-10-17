import { NatureOperationVente, NatureReponseDevis } from '@prisma/client';
export declare class LigneDevisDto {
    designation: string;
    quantite: number;
    prixUnitaire: number;
    montantHT: number;
}
export declare class EmettreDevisDto {
    numero: string;
    dateEmission: string;
    nature: NatureOperationVente;
    tiersId?: string;
    clientNom?: string;
    objet?: string;
    delaiJours?: number;
    declareeIrrevocable?: boolean;
    destinataireDetermine?: boolean;
    volonteDEtreLie?: boolean;
    dateReception?: string;
    contrePropositionDeId?: string;
    lignes: LigneDevisDto[];
}
export declare class EnregistrerReponseDto {
    natureReponse: NatureReponseDevis;
    dateReponse: string;
    detailReponse?: string;
}
export declare class RevoquerDevisDto {
    revoqueLe: string;
    motifRevocation: string;
}
export declare class ListerDevisDto {
    dateReference?: string;
    du?: string;
    au?: string;
}
