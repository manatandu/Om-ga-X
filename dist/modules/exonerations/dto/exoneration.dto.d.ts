import { StatutExoneration, TypeDemandeExoneration } from '@prisma/client';
export declare class CreerExonerationDto {
    type: TypeDemandeExoneration;
    objet: string;
    statut?: StatutExoneration;
    referenceArrete?: string;
    dateArrete?: string;
    dateDebutValidite?: string;
    dateFinValidite?: string;
    lettreTransport?: string;
    valeurBiens?: number;
    franchiseDouaniere?: string;
    piecesFournies?: string[];
    observations?: string;
}
export declare class ModifierExonerationDto {
    statut?: StatutExoneration;
    objet?: string;
    referenceArrete?: string;
    dateArrete?: string;
    dateDebutValidite?: string;
    dateFinValidite?: string;
    lettreTransport?: string;
    valeurBiens?: number;
    franchiseDouaniere?: string;
    piecesFournies?: string[];
    observations?: string;
}
export declare class ListerExonerationsDto {
    dateReference?: string;
    du?: string;
    au?: string;
}
