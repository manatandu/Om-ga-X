export type SensBilan = 'ACTIF' | 'PASSIF';
export type QualificatifSens = 'DEBITEUR' | 'CREDITEUR';
export interface PosteBilanDeBase {
    ref: string;
    libelle: string;
    sens: SensBilan;
    note?: string;
    renvoi?: string;
    comptes: string[];
    exclusions?: string[];
    comptesAmortissement?: string[];
    exclusionsAmortissement?: string[];
    comptesTransferesSiCrediteur?: string[];
    sens_qualificatif?: QualificatifSens;
}
export declare const POSTES_ACTIF_SYSCOHADA: PosteBilanDeBase[];
export declare const POSTES_PASSIF_SYSCOHADA: PosteBilanDeBase[];
export declare const COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA: string[];
export declare const REF_TRESORERIE_PASSIF_SYSCOHADA = "DR";
export declare const REF_RESULTAT_SYSCOHADA = "CJ";
export declare const LIBELLE_RESULTAT_SYSCOHADA = "R\u00E9sultat net de l'exercice (b\u00E9n\u00E9fice + ou perte -)";
export declare const COMPTES_RESULTAT_SYSCOHADA: string[];
export declare const COMPTES_BILAN_SANS_POSTE_JUSTIFIES: {
    prefixe: string;
    anomalie: number;
    motif: string;
}[];
export declare const COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE: {
    prefixe: string;
    anomalie: number;
    source: string;
}[];
export declare function trouvePosteActifSyscohada(ref: string): PosteBilanDeBase | undefined;
export declare function trouvePostePassifSyscohada(ref: string): PosteBilanDeBase | undefined;
export interface TotalBilan {
    ref: string;
    libelle: string;
    note?: string;
    deRefs: string[];
}
export declare const TOTAUX_ACTIF_SYSCOHADA: TotalBilan[];
export declare const TOTAUX_PASSIF_SYSCOHADA: TotalBilan[];
export declare const ORDRE_AFFICHAGE_ACTIF_SYSCOHADA: string[];
export declare const ORDRE_AFFICHAGE_PASSIF_SYSCOHADA: string[];
