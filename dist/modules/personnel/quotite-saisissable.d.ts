import { type Annexe } from './bareme-smig';
export declare const DIVISEUR_EVALUATION_FORFAITAIRE_LOGEMENT = 5;
export declare const MULTIPLE_DU_MINIMUM_CATEGORIEL = 5;
export declare const FRACTION_SOUS_LE_SEUIL: {
    readonly numerateur: 1;
    readonly denominateur: 5;
};
export declare const FRACTION_AU_DESSUS_DU_SEUIL: {
    readonly numerateur: 1;
    readonly denominateur: 3;
};
export declare const FRACTION_OBLIGATION_ALIMENTAIRE: {
    readonly numerateur: 2;
    readonly denominateur: 5;
};
export declare const JOURS_DU_MOIS: 26;
export type MotifAbstentionQuotite = 'CLASSE_PROFESSIONNELLE_ABSENTE' | 'MOIS_HORS_ANNEXE' | 'IMPOT_NON_CHIFFRE' | 'COTISATION_NON_CHIFFREE';
export type EntreeQuotite = {
    readonly moisDePaie: string;
    readonly annexesSmig?: readonly Annexe[];
    readonly remunerationFc: number;
    readonly classeProfessionnelle?: number | null;
    readonly retenuesFiscalesFc?: number | null;
    readonly retenuesSocialesFc?: number | null;
    readonly logementFourniEnNature?: boolean;
    readonly logementEnNatureDejaDefalque?: boolean;
    readonly indemniteDeLogementVersee?: boolean;
    readonly obligationAlimentaireLegale?: boolean;
};
export type VerdictQuotite = {
    readonly baseFc: number | null;
    readonly evaluationForfaitaireLogementFc: number | null;
    readonly seuilFc: number | null;
    readonly mensuelMinimumFc: number | null;
    readonly quotiteOrdinaireFc: number | null;
    readonly quotiteAlimentaireFc: number | null;
    readonly quotiteCumuleeFc: number | null;
    readonly partInsaisissableFc: number | null;
    readonly abstentions: readonly {
        motif: MotifAbstentionQuotite;
        explication: string;
    }[];
    readonly reserves: readonly string[];
    readonly annexe: Annexe | null;
    readonly colonne: number | null;
};
export declare const RESERVE_CUMUL: string;
export declare const RESERVE_ASSIETTE_AUPSRVE: string;
export declare const RESERVE_CATEGORIE: string;
export declare const RESERVE_LOGEMENT: string;
export declare const RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES: string;
export declare const RESERVE_CONTINUITE_DES_TEXTES: string;
export declare const RESERVE_FACULTE_DE_DEFALCATION: string;
export declare function mensuelMinimumDeLaClasse(moisDePaie: string, classeProfessionnelle: number, annexesDossier?: readonly Annexe[]): {
    montantFc: number;
    annexe: Annexe;
    colonne: number;
} | null;
export declare function quotiteSaisissable(entree: EntreeQuotite): VerdictQuotite;
