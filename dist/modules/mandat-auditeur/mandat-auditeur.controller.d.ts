import { OrganeDesignationAuditeur } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MandatAuditeurService } from './mandat-auditeur.service';
import { CloreMandatDto, EnregistrerMandatDto, RefusProrogationDto } from './dto/mandat-auditeur.dto';
export declare class MandatAuditeurController {
    private readonly mandats;
    constructor(mandats: MandatAuditeurService);
    lister(user: AuthenticatedUser): Promise<{
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
    obligation(user: AuthenticatedUser): Promise<import("../controles/regles-auditeur").RegleAuditeur>;
    duree(user: AuthenticatedUser, organe: OrganeDesignationAuditeur): Promise<{
        reductionPossible: boolean;
        organeRefuse: string | null;
        successionPossible: boolean;
        exercices: number | null;
        mandatsMaximum: number | null;
        source: string;
    }>;
    enregistrer(user: AuthenticatedUser, dto: EnregistrerMandatDto): Promise<{
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
    refuserProrogation(user: AuthenticatedUser, id: string, dto: RefusProrogationDto): Promise<{
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
    clore(user: AuthenticatedUser, id: string, dto: CloreMandatDto): Promise<{
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
}
