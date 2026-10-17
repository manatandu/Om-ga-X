import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AnalytiqueService } from './analytique.service';
import { EtatsAnalytiquesService } from './etats-analytiques.service';
import { EngagementService } from './engagement.service';
import { CreerPlanAnalytiqueDto, CreerSectionDto, DoterBudgetDto, ModifierBudgetMoisDto, ModifierPlanAnalytiqueDto, ModifierSectionDto, VentilerLigneDto } from './dto/analytique.dto';
import { CreerOdAnalytiqueDto } from './dto/od-analytique.dto';
import { OdAnalytiqueService } from './od-analytique.service';
import { CloreEngagementDto, CreerEngagementDto, RattacherExecutionDto } from './dto/engagement.dto';
export declare class AnalytiqueController {
    private readonly analytique;
    private readonly etats;
    private readonly engagements;
    private readonly od;
    constructor(analytique: AnalytiqueService, etats: EtatsAnalytiquesService, engagements: EngagementService, od: OdAnalytiqueService);
    listerOd(user: AuthenticatedUser, exerciceId: string, planId?: string): Promise<{
        id: string;
        date: string;
        reference: string | null;
        libelle: string;
        planId: string;
        plan: {
            intitule: string;
            code: string;
        };
        compte: {
            numero: string;
            intitule: string;
        };
        montant: number;
        lignes: {
            sectionId: string;
            sectionCode: string;
            sectionIntitule: string;
            debit: number;
            credit: number;
        }[];
    }[]>;
    creerOd(user: AuthenticatedUser, dto: CreerOdAnalytiqueDto): Promise<{
        id: string;
    }>;
    supprimerOd(user: AuthenticatedUser, odId: string): Promise<{
        supprime: boolean;
    }>;
    listerPlans(user: AuthenticatedUser): Promise<({
        _count: {
            sections: number;
        };
    } & {
        id: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        classesVentilees: string;
        ventilationObligatoire: boolean;
        gererBudgets: boolean;
        ordre: number;
        longueurSections: number | null;
    })[]>;
    creerPlan(user: AuthenticatedUser, dto: CreerPlanAnalytiqueDto): Promise<{
        id: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        classesVentilees: string;
        ventilationObligatoire: boolean;
        gererBudgets: boolean;
        ordre: number;
        longueurSections: number | null;
    }>;
    modifierPlan(user: AuthenticatedUser, planId: string, dto: ModifierPlanAnalytiqueDto): Promise<{
        id: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        classesVentilees: string;
        ventilationObligatoire: boolean;
        gererBudgets: boolean;
        ordre: number;
        longueurSections: number | null;
    }>;
    apercuLongueurSections(user: AuthenticatedUser, planId: string, longueur?: string): Promise<{
        longueurActuelle: number | null;
        longueur: number | null;
        motif: string | null;
        horsLongueur: import("./longueur-sections").SectionHorsLongueur[];
        nombreHorsLongueur: number;
        nombreSections: number;
        proposee: number | null;
    }>;
    supprimerPlan(user: AuthenticatedUser, planId: string): Promise<{
        supprime: boolean;
    }>;
    listerSections(user: AuthenticatedUser, planId: string): Promise<({
        bailleur: {
            id: string;
            nom: string;
            code: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeCompteDetailTotal;
        dateDebut: Date | null;
        tenantId: string;
        dateFin: Date | null;
        intitule: string;
        bailleurId: string | null;
        code: string;
        estActive: boolean;
        planId: string;
    })[]>;
    creerSection(user: AuthenticatedUser, planId: string, dto: CreerSectionDto): Promise<{
        bailleur: {
            id: string;
            nom: string;
            code: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeCompteDetailTotal;
        dateDebut: Date | null;
        tenantId: string;
        dateFin: Date | null;
        intitule: string;
        bailleurId: string | null;
        code: string;
        estActive: boolean;
        planId: string;
    }>;
    modifierSection(user: AuthenticatedUser, sectionId: string, dto: ModifierSectionDto): Promise<{
        bailleur: {
            id: string;
            nom: string;
            code: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeCompteDetailTotal;
        dateDebut: Date | null;
        tenantId: string;
        dateFin: Date | null;
        intitule: string;
        bailleurId: string | null;
        code: string;
        estActive: boolean;
        planId: string;
    }>;
    supprimerSection(user: AuthenticatedUser, sectionId: string): Promise<{
        supprime: boolean;
    }>;
    budget(user: AuthenticatedUser, sectionId: string, exerciceId: string): Promise<{
        annuel: number;
        mensuel: {
            mois: number;
            montant: number;
        }[];
    }>;
    doterBudget(user: AuthenticatedUser, sectionId: string, dto: DoterBudgetDto): Promise<{
        annuel: number;
        mensuel: {
            mois: number;
            montant: number;
        }[];
    }>;
    modifierBudgetMois(user: AuthenticatedUser, sectionId: string, dto: ModifierBudgetMoisDto): Promise<{
        annuel: number;
        mensuel: {
            mois: number;
            montant: number;
        }[];
    }>;
    ventilations(user: AuthenticatedUser, ligneId: string): Promise<({
        section: {
            id: string;
            intitule: string;
            code: string;
            planId: string;
        };
    } & {
        id: string;
        planId: string;
        debit: import("@prisma/client/runtime/library").Decimal;
        credit: import("@prisma/client/runtime/library").Decimal;
        sectionId: string;
        ligneEcritureId: string;
    })[]>;
    ventiler(user: AuthenticatedUser, ligneId: string, dto: VentilerLigneDto): Promise<({
        section: {
            id: string;
            intitule: string;
            code: string;
            planId: string;
        };
    } & {
        id: string;
        planId: string;
        debit: import("@prisma/client/runtime/library").Decimal;
        credit: import("@prisma/client/runtime/library").Decimal;
        sectionId: string;
        ligneEcritureId: string;
    })[]>;
    effacer(user: AuthenticatedUser, ligneId: string): Promise<{
        efface: boolean;
    }>;
    balance(user: AuthenticatedUser, planId: string, exerciceId: string, dateDebut?: string, dateFin?: string): Promise<{
        lignes: import("./analytique.service").LigneBalanceAnalytique[];
        totaux: {
            debit: number;
            credit: number;
            solde: number;
        };
    }>;
    grandLivre(user: AuthenticatedUser, sectionId: string, exerciceId: string, dateDebut?: string, dateFin?: string): Promise<{
        section: {
            id: string;
            code: string;
            intitule: string;
            plan: {
                intitule: string;
                code: string;
            };
            dateDebut: string | null;
            dateFin: string | null;
        };
        lignes: import("./etats-analytiques.service").LigneGrandLivreAnalytique[];
        totaux: {
            debit: number;
            credit: number;
            solde: number;
        };
    }>;
    controleCumuls(user: AuthenticatedUser, exerciceId: string, planId?: string, dateDebut?: string, dateFin?: string): Promise<import("./etats-analytiques.service").LigneControleCumuls[]>;
    etatBudgetaire(user: AuthenticatedUser, planId: string, exerciceId: string, mois?: string, dateDebut?: string, dateFin?: string): Promise<{
        lignes: import("./analytique.service").LigneEtatBudgetaire[];
        totaux: import("./analytique.service").LigneEtatBudgetaire;
    }>;
    listerEngagements(user: AuthenticatedUser, exerciceId: string): Promise<{
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
                libelle: string;
                date: Date;
                numeroPiece: number | null;
            };
        }[];
    }[]>;
    ecrituresRattachables(user: AuthenticatedUser, exerciceId: string, recherche?: string): Promise<{
        ecritures: {
            id: string;
            libelle: string;
            date: Date;
            reference: string | null;
            numeroPiece: number | null;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creerEngagement(user: AuthenticatedUser, dto: CreerEngagementDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEngagement;
        tenantId: string;
        objet: string;
        nature: import(".prisma/client").$Enums.NatureEngagement;
        montant: import("@prisma/client/runtime/library").Decimal;
        exerciceId: string;
        updatedAt: Date;
        createdBy: string;
        date: Date;
        reference: string;
        motifCloture: string | null;
        sectionId: string;
        beneficiaire: string;
    }>;
    rattacherExecution(user: AuthenticatedUser, engagementId: string, dto: RattacherExecutionDto): Promise<{
        id: string;
        createdAt: Date;
        montant: import("@prisma/client/runtime/library").Decimal;
        createdBy: string;
        ecritureId: string;
        engagementId: string;
    }>;
    detacherExecution(user: AuthenticatedUser, engagementId: string, executionId: string): Promise<{
        detache: boolean;
    }>;
    cloreEngagement(user: AuthenticatedUser, engagementId: string, dto: CloreEngagementDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEngagement;
        tenantId: string;
        objet: string;
        nature: import(".prisma/client").$Enums.NatureEngagement;
        montant: import("@prisma/client/runtime/library").Decimal;
        exerciceId: string;
        updatedAt: Date;
        createdBy: string;
        date: Date;
        reference: string;
        motifCloture: string | null;
        sectionId: string;
        beneficiaire: string;
    }>;
    rouvrirEngagement(user: AuthenticatedUser, engagementId: string): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEngagement;
        tenantId: string;
        objet: string;
        nature: import(".prisma/client").$Enums.NatureEngagement;
        montant: import("@prisma/client/runtime/library").Decimal;
        exerciceId: string;
        updatedAt: Date;
        createdBy: string;
        date: Date;
        reference: string;
        motifCloture: string | null;
        sectionId: string;
        beneficiaire: string;
    }>;
    supprimerEngagement(user: AuthenticatedUser, engagementId: string): Promise<{
        supprime: boolean;
    }>;
}
