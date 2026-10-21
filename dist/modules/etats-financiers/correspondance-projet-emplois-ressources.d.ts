export type SensMouvement = 'DEBIT' | 'CREDIT';
export type OperationCorrection = 'AJOUTER_VARIATION' | 'RETRANCHER_MOUVEMENT';
export interface DeductionEmploisRessources {
    comptes: string[];
    exclusions?: string[];
    operation: OperationCorrection;
    renvoi: string;
}
export interface PosteEmploisRessources {
    ref: string;
    libelle: string;
    section: 'RESSOURCES' | 'IMMOBILISATIONS' | 'CHARGES' | 'FONDS_DEBUT' | 'FONDS_FIN';
    sens: SensMouvement;
    comptes: string[];
    exclusions?: string[];
    lectureSolde?: 'DEBITEUR_CLOTURE' | 'DEBITEUR_OUVERTURE';
    deductions?: DeductionEmploisRessources[];
    fondement: string;
}
export declare const POSTES_RESSOURCES: PosteEmploisRessources[];
export declare const POSTES_IMMOBILISATIONS: PosteEmploisRessources[];
export declare const POSTES_CHARGES: PosteEmploisRessources[];
export declare const COMPTES_TRESORERIE_PROJET: string[];
export interface TotalEmploisRessources {
    ref: string;
    libelle: string;
    deRefs: string[];
}
export declare const TOTAUX: TotalEmploisRessources[];
export declare const ORDRE_AFFICHAGE: string[];
export declare const LIBELLES_CALCULES: Record<string, string>;
export declare const REFS_DE_SOLDE: string[];
