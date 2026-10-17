import { ActivitePrincipaleIfrs, CategorieEffetChangeIfrs, ComposanteCpIfrs, TypeMouvementCpIfrs } from '@prisma/client';
export declare class ActiviteIfrsDto {
    activitePrincipale?: ActivitePrincipaleIfrs | null;
}
export declare class RegleIfrsDto {
    prefixe: string;
    rubrique: string;
}
export declare class LigneRetraitementIfrsDto {
    rubrique: string;
    montant: number;
}
export declare class RetraitementIfrsDto {
    exerciceId: string;
    libelle: string;
    fondement: string;
    lignes: LigneRetraitementIfrsDto[];
    aLaTransition?: boolean;
    correctionErreur?: boolean;
    consolide?: boolean;
    partMinoritairesResultat?: number | null;
    partMinoritairesOci?: number | null;
    partMinoritairesCapitauxPropres?: number | null;
}
export declare class RegleConsolidationIfrsDto {
    poste: string;
    rubrique: string;
}
export declare class PremiereApplicationIfrsDto {
    premierExerciceIfrsId?: string | null;
    dejaAdoptant?: boolean;
    consolide?: boolean;
    exemptionRegroupementsC1?: boolean | null;
}
export declare class MouvementCpIfrsDto {
    exerciceId: string;
    type: TypeMouvementCpIfrs;
    composante: ComposanteCpIfrs;
    montant: number;
    libelle: string;
    justification: string;
    consolide?: boolean;
}
export declare class TresorerieIfrsDto {
    decouvertsDansTresorerie?: boolean | null;
    tresorerieEnDevises?: boolean | null;
    tresorerieGroupeEnDevises?: boolean | null;
}
export declare class EffetChangeIfrsDto {
    exerciceId: string;
    montant: number;
    categorie: CategorieEffetChangeIfrs;
    justification: string;
    consolide?: boolean;
}
export declare class NotesIfrsDto {
    exerciceId: string;
    contenu: Record<string, unknown>;
    consolide?: boolean;
}
