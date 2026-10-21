import { OrganeDesignationAuditeur } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { NatureSuccession } from './duree-mandat';
export declare class MandatAuditeurService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private dossier;
    dureeProposee(tenantId: string, organe: OrganeDesignationAuditeur): Promise<{
        reductionPossible: boolean;
        organeRefuse: string | null;
        successionPossible: boolean;
        exercices: number | null;
        mandatsMaximum: number | null;
        source: string;
    }>;
    lister(tenantId: string): Promise<{
        mandats: {
            dernierExerciceCouvert: number;
            nom: string;
            rang: number;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            nombreExercices: number;
            motifFin: string | null;
            inscriptionOrdre: string;
            organeDesignation: import(".prisma/client").$Enums.OrganeDesignationAuditeur;
            dateDesignation: Date;
            premierExercice: number;
            refusDeProrogation: boolean;
            finAnticipeeLe: Date | null;
            mandatOrigineId: string | null;
            natureSuccession: import(".prisma/client").$Enums.NatureSuccessionMandat | null;
        }[];
        referentiel: import(".prisma/client").$Enums.Referentiel;
        fondementInscription: {
            source: string;
            texte: string;
        };
    }>;
    enregistrer(tenantId: string, dto: {
        nom: string;
        inscriptionOrdre: string;
        organeDesignation: OrganeDesignationAuditeur;
        dateDesignation: string;
        premierExercice: number;
        nombreExercices: number;
        rang?: number;
        mandatOrigineId?: string;
        natureSuccession?: NatureSuccession;
    }): Promise<{
        nom: string;
        rang: number;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        nombreExercices: number;
        motifFin: string | null;
        inscriptionOrdre: string;
        organeDesignation: import(".prisma/client").$Enums.OrganeDesignationAuditeur;
        dateDesignation: Date;
        premierExercice: number;
        refusDeProrogation: boolean;
        finAnticipeeLe: Date | null;
        mandatOrigineId: string | null;
        natureSuccession: import(".prisma/client").$Enums.NatureSuccessionMandat | null;
    }>;
    private origineDeLaSuccession;
    refuserProrogation(tenantId: string, id: string, refus: boolean): Promise<{
        nom: string;
        rang: number;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        nombreExercices: number;
        motifFin: string | null;
        inscriptionOrdre: string;
        organeDesignation: import(".prisma/client").$Enums.OrganeDesignationAuditeur;
        dateDesignation: Date;
        premierExercice: number;
        refusDeProrogation: boolean;
        finAnticipeeLe: Date | null;
        mandatOrigineId: string | null;
        natureSuccession: import(".prisma/client").$Enums.NatureSuccessionMandat | null;
    }>;
    clore(tenantId: string, id: string, dto: {
        finAnticipeeLe: string;
        motifFin: string;
    }): Promise<{
        nom: string;
        rang: number;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        nombreExercices: number;
        motifFin: string | null;
        inscriptionOrdre: string;
        organeDesignation: import(".prisma/client").$Enums.OrganeDesignationAuditeur;
        dateDesignation: Date;
        premierExercice: number;
        refusDeProrogation: boolean;
        finAnticipeeLe: Date | null;
        mandatOrigineId: string | null;
        natureSuccession: import(".prisma/client").$Enums.NatureSuccessionMandat | null;
    }>;
    obligation(tenantId: string): Promise<import("../controles/regles-auditeur").RegleAuditeur>;
}
