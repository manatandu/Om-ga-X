import { PosteConsolidation, ResultatCumul } from '../consolidation/cumul-consolidation';
import { NatureChangementPerimetre } from '../consolidation/flux-capitaux-consolides';
import { ActivitePrincipale, EtatsIfrs, RegleCorrespondance, RetraitementDeclare } from './etats-ifrs';
export interface ComparaisonConversion {
    cumulPrecedent: ResultatCumul | null;
    changements: {
        nom: string;
        nature: NatureChangementPerimetre;
    }[];
}
export declare const aDesEcartsDeConversion: (c: ResultatCumul) => boolean;
export declare function variationConversionExercice(cumul: ResultatCumul, comparaison: ComparaisonConversion | null | undefined): {
    variation: {
        groupe: number;
        minoritaires: number;
        me: number;
    } | null;
    motif: string | null;
};
export declare const POSTES_RANGES: Partial<Record<PosteConsolidation, {
    rubrique: string;
    fondement: string;
}>>;
export declare const POSTES_A_DECLARER: PosteConsolidation[];
export interface RegleConsolidation {
    poste: string;
    rubrique: string;
}
export declare function motifRefusRegleConsolidation(poste: string, rubrique: string): string | null;
export interface EtatsIfrsConsolides extends EtatsIfrs {
    postes: {
        poste: string;
        libelle: string;
        solde: number;
        rubrique: string | null;
        fondement: string | null;
        declare: boolean;
    }[];
}
export declare function construireEtatsIfrsConsolides(exercice: {
    dateDebut: Date;
}, cumul: ResultatCumul, regles: RegleCorrespondance[], reglesConsolidation: RegleConsolidation[], retraitements: RetraitementDeclare[], activitePrincipale: ActivitePrincipale | null, comparaison?: ComparaisonConversion | null): EtatsIfrsConsolides;
