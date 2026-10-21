import { PrismaService } from '../../common/prisma.service';
import { Prisma, Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { CreerPlanAnalytiqueDto, CreerSectionDto, DoterBudgetDto, LigneVentilationDto, ModifierBudgetMoisDto, ModifierPlanAnalytiqueDto, ModifierSectionDto } from './dto/analytique.dto';
export interface LigneBalanceAnalytique {
    sectionId: string;
    code: string;
    intitule: string;
    type: TypeCompteDetailTotal;
    debit: number;
    credit: number;
    solde: number;
}
export interface LigneEtatBudgetaire {
    sectionId: string | null;
    code: string;
    intitule: string;
    estRubrique: boolean;
    budget: number;
    realise: number;
    ecart: number;
    tauxConsommation: number | null;
    horsBudget: boolean;
}
export declare class AnalytiqueService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    seedPlansDefaut(tenantId: string, referentiel: Referentiel, client?: Prisma.TransactionClient): Promise<void>;
    listerPlans(tenantId: string): Promise<({
        _count: {
            sections: number;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        classesVentilees: string;
        ventilationObligatoire: boolean;
        gererBudgets: boolean;
        ordre: number;
        longueurSections: number | null;
    })[]>;
    creerPlan(tenantId: string, dto: CreerPlanAnalytiqueDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        classesVentilees: string;
        ventilationObligatoire: boolean;
        gererBudgets: boolean;
        ordre: number;
        longueurSections: number | null;
    }>;
    modifierPlan(tenantId: string, planId: string, dto: ModifierPlanAnalytiqueDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        classesVentilees: string;
        ventilationObligatoire: boolean;
        gererBudgets: boolean;
        ordre: number;
        longueurSections: number | null;
    }>;
    apercuLongueurSections(tenantId: string, planId: string, longueur: number | null): Promise<{
        longueurActuelle: number | null;
        longueur: number | null;
        motif: string | null;
        horsLongueur: import("./longueur-sections").SectionHorsLongueur[];
        nombreHorsLongueur: number;
        nombreSections: number;
        proposee: number | null;
    }>;
    private releverLongueurs;
    private verrouillerPlan;
    supprimerPlan(tenantId: string, planId: string): Promise<{
        supprime: boolean;
    }>;
    private sectionsQuiPortentUnDocument;
    private refuserSuppressionAnalytique;
    private trouverPlan;
    listerSections(tenantId: string, planId: string): Promise<({
        bailleur: {
            nom: string;
            id: string;
            code: string;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.TypeCompteDetailTotal;
        id: string;
        tenantId: string;
        createdAt: Date;
        dateDebut: Date | null;
        intitule: string;
        bailleurId: string | null;
        code: string;
        estActive: boolean;
        planId: string;
        dateFin: Date | null;
    })[]>;
    creerSection(tenantId: string, planId: string, dto: CreerSectionDto): Promise<{
        bailleur: {
            nom: string;
            id: string;
            code: string;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.TypeCompteDetailTotal;
        id: string;
        tenantId: string;
        createdAt: Date;
        dateDebut: Date | null;
        intitule: string;
        bailleurId: string | null;
        code: string;
        estActive: boolean;
        planId: string;
        dateFin: Date | null;
    }>;
    modifierSection(tenantId: string, sectionId: string, dto: ModifierSectionDto): Promise<{
        bailleur: {
            nom: string;
            id: string;
            code: string;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.TypeCompteDetailTotal;
        id: string;
        tenantId: string;
        createdAt: Date;
        dateDebut: Date | null;
        intitule: string;
        bailleurId: string | null;
        code: string;
        estActive: boolean;
        planId: string;
        dateFin: Date | null;
    }>;
    supprimerSection(tenantId: string, sectionId: string): Promise<{
        supprime: boolean;
    }>;
    private trouverSection;
    private sectionEtExerciceDotables;
    doterBudget(tenantId: string, sectionId: string, dto: DoterBudgetDto): Promise<{
        annuel: number;
        mensuel: {
            mois: number;
            montant: number;
        }[];
    }>;
    modifierBudgetMois(tenantId: string, sectionId: string, dto: ModifierBudgetMoisDto): Promise<{
        annuel: number;
        mensuel: {
            mois: number;
            montant: number;
        }[];
    }>;
    budget(tenantId: string, sectionId: string, exerciceId: string): Promise<{
        annuel: number;
        mensuel: {
            mois: number;
            montant: number;
        }[];
    }>;
    private moisCouverts;
    ventilerLigne(tenantId: string, ligneEcritureId: string, ventilations: LigneVentilationDto[]): Promise<({
        section: {
            id: string;
            intitule: string;
            code: string;
            planId: string;
        };
    } & {
        id: string;
        planId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        sectionId: string;
        ligneEcritureId: string;
    })[]>;
    effacerVentilation(tenantId: string, ligneEcritureId: string): Promise<{
        efface: boolean;
    }>;
    ventilationsDeLigne(tenantId: string, ligneEcritureId: string): Promise<({
        section: {
            id: string;
            intitule: string;
            code: string;
            planId: string;
        };
    } & {
        id: string;
        planId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        sectionId: string;
        ligneEcritureId: string;
    })[]>;
    verifierVentilationObligatoire(tenantId: string, lignes: {
        compteId: string;
        ventilations?: LigneVentilationDto[];
    }[]): Promise<void>;
}
