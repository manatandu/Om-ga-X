import { CycleCircularisation, FormeConfirmation, NatureEcartConfirmation, StatutDemandeConfirmation } from '@prisma/client';
export declare class CreerCampagneCircularisationDto {
    exerciceId: string;
    libelle: string;
    dateArrete: string;
    cycle: CycleCircularisation;
    forme?: FormeConfirmation;
    methodeSelection?: string;
    conditionsNegativeReunies?: string[];
}
export declare class CreerDemandeDto {
    compteId: string;
    tiersId?: string;
    destinataire: string;
    adresse?: string;
    soldeAConfirmer?: number;
}
export declare class EnvoyerDto {
    date?: string;
}
export declare class DepouillerDto {
    statut: StatutDemandeConfirmation;
    date?: string;
    soldeConfirme?: number;
    natureEcart?: NatureEcartConfirmation;
    investigation?: string;
    reponseIndirecte?: boolean;
    doutefiabilite?: string;
}
export declare class ProceduresAlternativesDto {
    proceduresAlternatives: string;
}
export declare class ClorerCampagneDto {
    refusDirectionMotif?: string;
}
