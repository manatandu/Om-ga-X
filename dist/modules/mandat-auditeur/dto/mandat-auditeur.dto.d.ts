import { OrganeDesignationAuditeur } from '@prisma/client';
export declare class EnregistrerMandatDto {
    nom: string;
    inscriptionOrdre: string;
    organeDesignation: OrganeDesignationAuditeur;
    dateDesignation: string;
    premierExercice: number;
    nombreExercices: number;
    rang?: number;
    mandatOrigineId?: string;
    natureSuccession?: 'REMPLACEMENT' | 'SUPPLEANT';
}
export declare class RefusProrogationDto {
    refus: boolean;
}
export declare class CloreMandatDto {
    finAnticipeeLe: string;
    motifFin: string;
}
