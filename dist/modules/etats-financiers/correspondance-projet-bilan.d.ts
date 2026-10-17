export type SensBilan = 'ACTIF' | 'PASSIF';
export type QualificatifSens = 'DEBITEUR' | 'CREDITEUR';
export interface PosteBilanProjetDeBase {
    ref: string;
    libelle: string;
    sens: SensBilan;
    comptes: string[];
    exclusions?: string[];
    sens_qualificatif?: QualificatifSens;
    comptesTransferesSiCrediteur?: string[];
}
export declare const POSTES_ACTIF: PosteBilanProjetDeBase[];
export declare const POSTES_PASSIF: PosteBilanProjetDeBase[];
export declare const COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR: string[];
export declare function trouvePosteActif(ref: string): PosteBilanProjetDeBase | undefined;
export declare function trouvePostePassif(ref: string): PosteBilanProjetDeBase | undefined;
export interface TotalBilanProjet {
    ref: string;
    libelle: string;
    deRefs: string[];
}
export declare const TOTAUX_ACTIF: TotalBilanProjet[];
export declare const TOTAUX_PASSIF: TotalBilanProjet[];
export declare const ORDRE_AFFICHAGE_ACTIF: string[];
export declare const ORDRE_AFFICHAGE_PASSIF: string[];
