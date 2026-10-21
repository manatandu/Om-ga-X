import { PrismaService } from '../../../common/prisma.service';
import { OdAnalytiqueService } from '../od-analytique.service';
import { type Comportement } from './comportement-gestion';
import type { CreerCleRepartitionDto, DeclarerComportementsDto, DeclarerCoutProductionDto, RepartirDto } from './dto/comptabilite-gestion.dto';
export declare class ComptabiliteGestionService {
    private readonly prisma;
    private readonly od;
    constructor(prisma: PrismaService, od: OdAnalytiqueService);
    private exercice;
    private refuserSiClos;
    private mouvementsDeGestion;
    comportements(tenantId: string, exerciceId: string): Promise<{
        comptes: {
            compteId: string;
            numero: string;
            intitule: string;
            classe: string;
            comportement: import(".prisma/client").$Enums.ComportementGestion | null;
            partVariablePct: number | null;
            mouvementDebit: number;
            mouvementCredit: number;
        }[];
        total: number;
        tronque: boolean;
    }>;
    declarerComportements(tenantId: string, dto: DeclarerComportementsDto): Promise<{
        declares: number;
    }>;
    private figerLesExercicesClos;
    private comportementsDe;
    seuilRentabilite(tenantId: string, exerciceId: string): Promise<{
        produits: number;
        chargesVariables: number;
        chargesFixes: number;
        marge: number;
        tauxMarge: number | null;
        seuil: number | null;
        margeSecurite: number | null;
        indiceSecurite: number | null;
        pointMortMois: number | null;
        motif: string | null;
        horsCalcul: {
            numero: string;
            intitule: string;
            montant: number;
        }[];
        nonDeclares: {
            numero: string;
            intitule: string;
            montant: number;
        }[];
        exercice: {
            id: string;
            dateDebut: string;
            dateFin: string;
            mois: number;
        };
        brouillardCompris: boolean;
        comportementsFigesLe: string | null;
    }>;
    private cumulsDeSection;
    cles(tenantId: string, exerciceId: string): Promise<{
        id: string;
        planId: string;
        plan: {
            intitule: string;
            code: string;
        };
        sectionSourceId: string;
        sectionSource: {
            intitule: string;
            code: string;
        };
        libelle: string;
        mode: import(".prisma/client").$Enums.ModeCleRepartition;
        unite: string | null;
        source: string;
        odsProduites: number;
        lignes: {
            sectionCibleId: string;
            code: string;
            intitule: string;
            valeur: number;
        }[];
    }[]>;
    private sectionsDuPlan;
    creerCle(tenantId: string, userId: string, dto: CreerCleRepartitionDto): Promise<{
        id: string;
    }>;
    supprimerCle(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    reprendreCles(tenantId: string, userId: string, exerciceId: string): Promise<{
        reprises: number;
        ecartees: {
            section: string;
            motif: string;
        }[];
    }>;
    proposition(tenantId: string, cleId: string, dateTexte?: string): Promise<{
        cle: {
            id: string;
            libelle: string;
            sectionSource: {
                intitule: string;
                code: string;
            };
        };
        date: string;
        exerciceClos: boolean;
        ods: {
            lignes: {
                code: string | null;
                sectionId: string;
                debit: number;
                credit: number;
            }[];
            compteId: string;
            numero: string;
            intitule: string;
            solde: number;
        }[];
        total: number;
    }>;
    private calculerProposition;
    repartir(tenantId: string, userId: string, cleId: string, dto: RepartirDto): Promise<{
        ods: number;
        total: number;
    }>;
    coutsProduction(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: string;
            dateFin: string;
        };
        comportementsFigesLe: string | null;
        declarations: {
            charges: {
                comportement: Comportement | null;
                partVariablePct: number | null;
                compteId: string;
                numero: string;
                intitule: string;
                montant: number;
            }[];
            produitsVentiles: number;
            calcul: import("./cout-production").CoutDeProduction;
            capaciteNormale: number;
            activiteReelle: number;
            quantiteProduite: number | null;
            id: string;
            sectionId: string;
            section: {
                intitule: string;
                code: string;
            };
            unite: string;
            source: string;
        }[];
    }>;
    declarerCoutProduction(tenantId: string, userId: string, dto: DeclarerCoutProductionDto): Promise<{
        id: string;
    }>;
    supprimerCoutProduction(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
