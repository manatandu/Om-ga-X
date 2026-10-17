import { CycleQuestionnaire, ReponseItem } from '@prisma/client';
export declare class CreerQuestionnaireDto {
    exerciceId: string;
    libelle: string;
    cycles?: CycleQuestionnaire[];
}
export declare class RepondreDto {
    code: string;
    reponse?: ReponseItem;
    valeur?: string;
    renvoiTravaux?: string;
    commentaire?: string;
}
export declare class ClorerQuestionnaireDto {
    motifCloture?: string;
}
