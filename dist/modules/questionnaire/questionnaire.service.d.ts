import { CycleQuestionnaire, Referentiel, ReponseItem } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { type ItemQuestionnaire } from './catalogue-questionnaire';
import { ClorerQuestionnaireDto, CreerQuestionnaireDto, RepondreDto } from './dto/questionnaire.dto';
export declare class QuestionnaireService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    static readonly ITEMS: readonly ItemQuestionnaire[];
    static itemsInterrogatifsCpcc(): ItemQuestionnaire[];
    static itemsRetenus(cycles: CycleQuestionnaire[], referentiel: Referentiel): ItemQuestionnaire[];
    static estException(item: ItemQuestionnaire, reponse: ReponseItem | null): boolean;
    static estOuvert(item: ItemQuestionnaire, reponses: Map<string, ReponseItem | null>): boolean;
    static reponsesDesItemsOuverts<R extends {
        code: string;
        reponse: ReponseItem | null;
    }>(items: ItemQuestionnaire[], reponses: R[]): R[];
    static motifsRefusCloture(items: ItemQuestionnaire[], reponses: {
        code: string;
        reponse: ReponseItem | null;
        valeur: string | null;
        renvoiTravaux: string | null;
        estException: boolean;
        commentaire: string | null;
    }[]): string[];
    private questionnaire;
    private referentielDuDossier;
    creer(tenantId: string, userId: string, dto: CreerQuestionnaireDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    }>;
    repondre(tenantId: string, questionnaireId: string, userId: string, dto: RepondreDto): Promise<{
        commentaire: string | null;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        questionnaireId: string;
        reponse: import(".prisma/client").$Enums.ReponseItem | null;
        valeur: string | null;
        estException: boolean;
        renvoiTravaux: string | null;
        reponduLe: Date | null;
        reponduPar: string | null;
    }>;
    clore(tenantId: string, questionnaireId: string, userId: string, dto: ClorerQuestionnaireDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    }>;
    lister(tenantId: string, exerciceId?: string): Promise<({
        _count: {
            reponses: number;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    })[]>;
    consulter(tenantId: string, questionnaireId: string): Promise<{
        lignes: {
            ouvert: boolean;
            reponse: {
                commentaire: string | null;
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                questionnaireId: string;
                reponse: import(".prisma/client").$Enums.ReponseItem | null;
                valeur: string | null;
                estException: boolean;
                renvoiTravaux: string | null;
                reponduLe: Date | null;
                reponduPar: string | null;
            } | null;
            code: string;
            cycle: CycleQuestionnaire;
            libelle: string;
            origine: import("./catalogue-questionnaire").OrigineItem;
            forme: import("./catalogue-questionnaire").FormeItem;
            polariteException?: "OUI" | "NON";
            ouvertPar?: {
                code: string;
                reponse: "OUI" | "NON";
            };
            objets?: string[];
            source?: string;
            fondement?: string;
            referentiel?: Referentiel;
        }[];
        synthese: {
            questions: number;
            repondues: number;
            tauxReponse: number;
            travaux: number;
            travauxFaits: number;
            exceptions: number;
            exceptionsSansCommentaire: number;
            itemsCpcc: number;
            itemsVmg: number;
        };
        motifsRefusCloture: string[];
        reponses: {
            commentaire: string | null;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            questionnaireId: string;
            reponse: import(".prisma/client").$Enums.ReponseItem | null;
            valeur: string | null;
            estException: boolean;
            renvoiTravaux: string | null;
            reponduLe: Date | null;
            reponduPar: string | null;
        }[];
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    }>;
}
