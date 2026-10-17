import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EngagementService } from '../analytique/engagement.service';
export interface LigneExecutionBudgetaire {
    code: string;
    libelle: string;
    estRubrique: boolean;
    budget: number;
    decaissement: number;
    engagementComptable: number;
    engagementHorsComptabilite: number;
    engagement: number;
    realisation: number;
    creditDisponible: number;
    executionPourcent: number | null;
}
export declare class AucunPlanABudgetsException extends NotFoundException {
}
export declare class EtatsFinanciersProjetBudgetService {
    private readonly ecritureService;
    private readonly prisma;
    private readonly engagementService;
    constructor(ecritureService: EcritureService, prisma: PrismaService, engagementService: EngagementService);
    private chargerLignes;
    private lignesOuvertesParmi;
    executionBudgetaire(tenantId: string, exerciceId: string, planId?: string): Promise<{
        plan: {
            id: string;
            code: string;
            intitule: string;
        };
        lignes: LigneExecutionBudgetaire[];
        total: {
            executionPourcent: number | null;
            budget: number;
            decaissement: number;
            engagementComptable: number;
            engagementHorsComptabilite: number;
            engagement: number;
            realisation: number;
            creditDisponible: number;
        };
        odAnalytiquesNonReprises: string | null;
        engagementsAnterieursNonSuivis: string | null;
        engagementsReglesSansImputation: string | null;
        engagementsHorsComptabilite: string;
    }>;
    reconciliationTresorerie(tenantId: string, exerciceId: string, paiementsEnInstance?: number | null): Promise<{
        lignes: {
            rep: string;
            libelle: string;
            montant: number | null;
        }[];
        controle: {
            tresorerieBalance: number;
            ecart: number;
            boucle: boolean;
        };
        avertissements: string[];
    }>;
}
