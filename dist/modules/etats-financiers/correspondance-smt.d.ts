export type SensSmt = 'ACTIF' | 'PASSIF';
export type QualificatifSensSmt = 'DEBITEUR' | 'CREDITEUR';
export interface PosteBilanSmt {
    ref: string;
    libelle: string;
    sens: SensSmt;
    note: string | null;
    comptes: string[];
    exclusions?: string[];
    sens_qualificatif?: QualificatifSensSmt;
    comptesSansFiltreDeSens?: string[];
    fondement: string;
}
export declare const DEPRECIATIONS_DES_TIERS: string[];
export declare const POSTES_BILAN_ACTIF: PosteBilanSmt[];
export declare const POSTES_BILAN_PASSIF: PosteBilanSmt[];
export interface TotalSmt {
    ref: string;
    libelle: string;
    deRefs: string[];
}
export declare const TOTAUX_BILAN_ACTIF: TotalSmt[];
export declare const TOTAUX_BILAN_PASSIF: TotalSmt[];
export declare const ORDRE_BILAN_ACTIF: string[];
export declare const ORDRE_BILAN_PASSIF: string[];
export declare const RENVOI_IMMOBILISATIONS = "(1) A faire figurer sur l'\u00E9tat de situation si elles correspondent \u00E0 des montants significatifs.";
export interface PosteFluxSmt {
    ref: string;
    libelle: string;
    sens: 'RECETTE' | 'DEPENSE';
    note: string | null;
    comptes: string[];
    exclusions?: string[];
    fondement: string;
}
export declare const POSTES_RECETTES: PosteFluxSmt[];
export declare const POSTES_DEPENSES: PosteFluxSmt[];
export interface RetraitementSmt {
    ref: string;
    libelle: string;
    signe: 1 | -1;
    fondement: string;
}
export declare const RETRAITEMENTS: RetraitementSmt[];
export declare const COMPTES_DOTATIONS_AMORTISSEMENTS: string[];
export declare const DETTES_HORS_EXPLOITATION: string[];
export interface ColonneVentilationSmt {
    cle: string;
    libelle: string;
    comptes: string[];
    exclusions?: string[];
}
export declare const VENTILATION_RECETTES: ColonneVentilationSmt[];
export declare const VENTILATION_DEPENSES: ColonneVentilationSmt[];
export declare const NB_JOURNAL_TRESORERIE: string;
export declare const COMPTES_CAUTIONS_NOTE_1: string[];
export declare const SOUS_COMPTES_APPORTEURS: string[];
export interface NoteSmt {
    numero: number;
    intitule: string;
    partie: 'BILAN' | 'COMPTE_DE_RESULTAT';
}
export declare const NOTES_SMT: NoteSmt[];
export declare const SEUIL_SMT_FCFA = 30000000;
export interface CategorieRessourceSmt {
    cle: string;
    libelle: string;
    comptes: string[];
    exclusions?: string[];
}
export declare const CATEGORIES_RESSOURCES_ART6: CategorieRessourceSmt[];
