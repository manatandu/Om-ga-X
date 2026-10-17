import { NatureEngagement } from '@prisma/client';
export declare class CreerEngagementDto {
    exerciceId: string;
    sectionId: string;
    nature: NatureEngagement;
    reference: string;
    objet: string;
    beneficiaire: string;
    date: string;
    montant: number;
}
export declare class RattacherExecutionDto {
    ecritureId: string;
    montant: number;
}
export declare class CloreEngagementDto {
    motif: string;
}
