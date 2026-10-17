export type SensBilan = 'ACTIF' | 'PASSIF';
export type QualificatifSens = 'DEBITEUR' | 'CREDITEUR';
export interface PosteBilanDeBase {
    ref: string;
    libelle: string;
    sens: SensBilan;
    comptes: string[];
    exclusions?: string[];
    comptesAmortissement?: string[];
    exclusionsAmortissement?: string[];
    comptesTransferesSiCrediteur?: string[];
    sens_qualificatif?: QualificatifSens;
}
export declare const POSTES_ACTIF: PosteBilanDeBase[];
export declare const POSTES_PASSIF: PosteBilanDeBase[];
export declare const COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR: string[];
export declare function trouvePosteActif(ref: string): PosteBilanDeBase | undefined;
export declare function trouvePostePassif(ref: string): PosteBilanDeBase | undefined;
export interface TotalBilan {
    ref: string;
    libelle: string;
    deRefs: string[];
}
export declare const TOTAUX_ACTIF: TotalBilan[];
export declare const TOTAUX_PASSIF: TotalBilan[];
export declare const ORDRE_AFFICHAGE_ACTIF: string[];
export declare const ORDRE_AFFICHAGE_PASSIF: string[];
