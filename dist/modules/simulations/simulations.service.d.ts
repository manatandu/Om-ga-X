import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { SimulationBudgetaireDto } from './dto/simulation.dto';
export declare class SimulationsService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    lister(tenantId: string): Prisma.PrismaPromise<({
        exerciceReference: {
            dateDebut: Date;
            dateFin: Date;
        };
        exerciceCible: {
            dateDebut: Date;
            dateFin: Date;
        };
    } & {
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        creePar: string;
        exerciceReferenceId: string;
        exerciceCibleId: string;
        hypotheses: Prisma.JsonValue;
        seuilOrangePct: Prisma.Decimal;
        seuilRougePct: Prisma.Decimal;
    })[]>;
    private verifier;
    private donnees;
    private conflit;
    creer(tenantId: string, auteur: string, dto: SimulationBudgetaireDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        creePar: string;
        exerciceReferenceId: string;
        exerciceCibleId: string;
        hypotheses: Prisma.JsonValue;
        seuilOrangePct: Prisma.Decimal;
        seuilRougePct: Prisma.Decimal;
    }>;
    modifier(tenantId: string, auteur: string, id: string, dto: SimulationBudgetaireDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        creePar: string;
        exerciceReferenceId: string;
        exerciceCibleId: string;
        hypotheses: Prisma.JsonValue;
        seuilOrangePct: Prisma.Decimal;
        seuilRougePct: Prisma.Decimal;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    calculer(tenantId: string, id: string, options?: {
        arreteAu?: string;
        inclureBrouillard?: boolean;
    }): Promise<{
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
            hypotheses: Prisma.JsonValue;
            seuils: {
                orangePct: number;
                rougePct: number;
            };
        };
        arreteAu: string | null;
        prorata: number;
        reserves: string[];
    }>;
}
