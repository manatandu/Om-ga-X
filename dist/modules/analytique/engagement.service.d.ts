import { StatutEngagement } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CloreEngagementDto, CreerEngagementDto, RattacherExecutionDto } from './dto/engagement.dto';
export declare class EngagementService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    static resteAExecuter(engagement: {
        statut: StatutEngagement;
        montant: unknown;
        executions: {
            montant: unknown;
        }[];
    }): number;
    resteParSection(tenantId: string, exerciceId: string): Promise<Map<string, number>>;
    lister(tenantId: string, exerciceId: string): Promise<{
        id: string;
        nature: import(".prisma/client").$Enums.NatureEngagement;
        reference: string;
        objet: string;
        beneficiaire: string;
        date: Date;
        montant: number;
        statut: import(".prisma/client").$Enums.StatutEngagement;
        motifCloture: string | null;
        section: {
            id: string;
            intitule: string;
            code: string;
        };
        montantExecute: number;
        resteAExecuter: number;
        executions: {
            id: string;
            montant: number;
            ecriture: {
                id: string;
                statut: import(".prisma/client").$Enums.StatutEcriture;
                date: Date;
                numeroPiece: number | null;
                libelle: string;
            };
        }[];
    }[]>;
    creer(tenantId: string, userId: string, dto: CreerEngagementDto): Promise<{
        objet: string;
        nature: import(".prisma/client").$Enums.NatureEngagement;
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEngagement;
        updatedAt: Date;
        createdBy: string;
        date: Date;
        exerciceId: string;
        reference: string;
        motifCloture: string | null;
        sectionId: string;
        beneficiaire: string;
    }>;
    rattacherExecution(tenantId: string, userId: string, engagementId: string, dto: RattacherExecutionDto): Promise<{
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        createdAt: Date;
        createdBy: string;
        ecritureId: string;
        engagementId: string;
    }>;
    detacherExecution(tenantId: string, engagementId: string, executionId: string): Promise<{
        detache: boolean;
    }>;
    clore(tenantId: string, engagementId: string, dto: CloreEngagementDto): Promise<{
        objet: string;
        nature: import(".prisma/client").$Enums.NatureEngagement;
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEngagement;
        updatedAt: Date;
        createdBy: string;
        date: Date;
        exerciceId: string;
        reference: string;
        motifCloture: string | null;
        sectionId: string;
        beneficiaire: string;
    }>;
    rouvrir(tenantId: string, engagementId: string): Promise<{
        objet: string;
        nature: import(".prisma/client").$Enums.NatureEngagement;
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEngagement;
        updatedAt: Date;
        createdBy: string;
        date: Date;
        exerciceId: string;
        reference: string;
        motifCloture: string | null;
        sectionId: string;
        beneficiaire: string;
    }>;
    supprimer(tenantId: string, engagementId: string): Promise<{
        supprime: boolean;
    }>;
    ecrituresRattachables(tenantId: string, exerciceId: string, recherche?: string): Promise<{
        ecritures: {
            id: string;
            date: Date;
            reference: string | null;
            numeroPiece: number | null;
            libelle: string;
        }[];
        total: number;
        tronque: boolean;
    }>;
}
