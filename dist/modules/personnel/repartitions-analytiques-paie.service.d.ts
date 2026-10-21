import { PrismaService } from '../../common/prisma.service';
import { type PlanConnu, type SectionConnue, type VersionRepartition } from './ventilation-analytique-paie';
import type { RepartitionAnalytiquePaieDto } from './dto/repartition-analytique-paie.dto';
export declare const PLAFOND_PLANS_LUS = 50;
export declare const PLAFOND_SECTIONS_PAR_PLAN = 500;
export declare const PLAFOND_VERSIONS_LUES = 200;
export declare const PLAFOND_VERSIONS_DU_MOIS = 20000;
export declare class RepartitionsAnalytiquesPaieService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private salarie;
    lire(tenantId: string, salarieId: string): Promise<{
        plans: {
            id: string;
            code: string;
            intitule: string;
            ventileLaPaie: boolean;
            sections: {
                id: string;
                intitule: string;
                code: string;
            }[];
            sectionsTronquees: boolean;
        }[];
        plansTronques: boolean;
        versions: {
            id: string;
            planId: string;
            planCode: string;
            planIntitule: string;
            moisEffet: string;
            createdAt: Date;
            retireLe: Date | null;
            motifRetrait: string | null;
            lignes: {
                sectionId: string;
                sectionCode: string;
                sectionIntitule: string;
                pourcentage: number;
            }[];
        }[];
        total: number;
        tronque: boolean;
    }>;
    declarer(tenantId: string, userId: string, salarieId: string, dto: RepartitionAnalytiquePaieDto): Promise<{
        id: string;
        moisEffet: string;
    }>;
    retirer(tenantId: string, userId: string, id: string, motif: string): Promise<{
        id: string;
        retireLe: Date | null;
    }>;
    pourLaPassation(tenantId: string, mois: string, salarieIds: readonly string[]): Promise<{
        plans: PlanConnu[];
        sections: SectionConnue[];
        versions: VersionRepartition[];
        obligatoires: string[];
    } | null>;
}
