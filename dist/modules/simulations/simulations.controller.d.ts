import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SimulationsService } from './simulations.service';
import { SimulationBudgetaireDto } from './dto/simulation.dto';
export declare class SimulationsController {
    private readonly service;
    constructor(service: SimulationsService);
    lister(user: AuthenticatedUser): import(".prisma/client").Prisma.PrismaPromise<({
        exerciceReference: {
            dateDebut: Date;
            dateFin: Date;
        };
        exerciceCible: {
            dateDebut: Date;
            dateFin: Date;
        };
    } & {
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        creePar: string;
        exerciceReferenceId: string;
        exerciceCibleId: string;
        hypotheses: import("@prisma/client/runtime/library").JsonValue;
        seuilOrangePct: import("@prisma/client/runtime/library").Decimal;
        seuilRougePct: import("@prisma/client/runtime/library").Decimal;
    })[]>;
    calculer(user: AuthenticatedUser, id: string, arreteAu?: string, inclureBrouillard?: string): Promise<{
        lignes: import("./simulateur-budgetaire").LigneSimulee[];
        totaux: {
            reference: {
                produits: number;
                charges: number;
                resultatActivitesOrdinaires: number;
            };
            prevuAnnuel: {
                produits: number;
                charges: number;
                resultatActivitesOrdinaires: number;
            };
            prevuADate: {
                produits: number;
                charges: number;
                resultatActivitesOrdinaires: number;
            };
            realise: {
                produits: number;
                charges: number;
                resultatActivitesOrdinaires: number;
            } | null;
            jaugeResultat: import("./simulateur-budgetaire").Jauge | null;
            ecartResultatPct: number | null;
        };
        simulation: {
            id: string;
            nom: string;
            hypotheses: import("@prisma/client/runtime/library").JsonValue;
            seuils: {
                orangePct: number;
                rougePct: number;
            };
        };
        arreteAu: string | null;
        prorata: number;
        reserves: string[];
    }>;
    creer(user: AuthenticatedUser, dto: SimulationBudgetaireDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        creePar: string;
        exerciceReferenceId: string;
        exerciceCibleId: string;
        hypotheses: import("@prisma/client/runtime/library").JsonValue;
        seuilOrangePct: import("@prisma/client/runtime/library").Decimal;
        seuilRougePct: import("@prisma/client/runtime/library").Decimal;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: SimulationBudgetaireDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        creePar: string;
        exerciceReferenceId: string;
        exerciceCibleId: string;
        hypotheses: import("@prisma/client/runtime/library").JsonValue;
        seuilOrangePct: import("@prisma/client/runtime/library").Decimal;
        seuilRougePct: import("@prisma/client/runtime/library").Decimal;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
