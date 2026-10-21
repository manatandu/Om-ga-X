import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { QuestionnaireService } from './questionnaire.service';
import { ClorerQuestionnaireDto, CreerQuestionnaireDto, RepondreDto } from './dto/questionnaire.dto';
export declare class QuestionnaireController {
    private readonly questionnaire;
    constructor(questionnaire: QuestionnaireService);
    lister(user: AuthenticatedUser, exerciceId?: string): Promise<({
        _count: {
            reponses: number;
        };
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    })[]>;
    catalogue(): {
        items: readonly import("./catalogue-questionnaire").ItemQuestionnaire[];
        interrogatifsCpcc: number;
    };
    consulter(user: AuthenticatedUser, id: string): Promise<{
        lignes: {
            ouvert: boolean;
            reponse: {
                id: string;
                createdAt: Date;
                tenantId: string;
                commentaire: string | null;
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
            cycle: import(".prisma/client").CycleQuestionnaire;
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
            referentiel?: import(".prisma/client").Referentiel;
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
            id: string;
            createdAt: Date;
            tenantId: string;
            commentaire: string | null;
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
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    }>;
    creer(user: AuthenticatedUser, dto: CreerQuestionnaireDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    }>;
    repondre(user: AuthenticatedUser, id: string, dto: RepondreDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
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
    clore(user: AuthenticatedUser, id: string, dto: ClorerQuestionnaireDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutQuestionnaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        closLe: Date | null;
        closPar: string | null;
        motifCloture: string | null;
        cycles: import(".prisma/client").$Enums.CycleQuestionnaire[];
    }>;
}
