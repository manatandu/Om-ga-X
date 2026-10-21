export type LectureFlux = 'NET_PRODUIT' | 'NET_CHARGE' | 'DEBIT_SEUL' | 'CREDIT_SEUL';
export type SensFlux = 'ENCAISSEMENT' | 'DECAISSEMENT';
export interface PosteFluxTresorerie {
    ref: string;
    libelle: string;
    sens: SensFlux;
    lectureFlux: LectureFlux;
    comptesFlux: string[];
    exclusionsFlux?: string[];
    comptesContrepartie?: string[];
    exclusionsContrepartie?: string[];
    note?: string;
    creditsARetrancher?: {
        comptes: string[];
        exclusions?: string[];
        fondement: string;
    }[];
    misesEnServiceARetrancher?: string;
    reevaluationARetrancher?: string;
    coutsEmpruntARetrancher?: string;
}
export declare const POSTES_OPERATIONNELS: PosteFluxTresorerie[];
export declare const POSTES_INVESTISSEMENT: PosteFluxTresorerie[];
export declare const POSTES_FONDS_PROPRES: PosteFluxTresorerie[];
export declare const POSTES_FONDS_ETRANGERS: PosteFluxTresorerie[];
export declare const TOUS_LES_POSTES_FLUX: PosteFluxTresorerie[];
export interface TotalFluxTresorerie {
    ref: string;
    libelle: string;
    repere?: string;
    deRefs: string[];
}
export declare const TOTAUX_FLUX: TotalFluxTresorerie[];
export declare const ORDRE_AFFICHAGE_FLUX: Array<{
    ref: string;
} | {
    section: string;
}>;
export declare function trouvePosteFlux(ref: string): PosteFluxTresorerie | undefined;
export declare const COMPTES_SANS_TRESORERIE: {
    numero: string;
    motif: string;
}[];
export declare const COMPTES_A_CONTREPARTIE_INTERNE: {
    numero: string;
    lecture: 'CREDIT' | 'MOUVEMENT';
    motif: string;
}[];
export declare const CONTREPARTIES_SANS_TRESORERIE: {
    numero: string;
    intitule: string;
    fondement: string;
}[];
