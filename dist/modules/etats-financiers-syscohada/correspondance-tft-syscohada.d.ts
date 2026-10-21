export type EtatSource = 'BILAN' | 'COMPTE_RESULTAT';
export type LecturePoste = 'N' | 'N1' | 'VARIATION';
export type ColonneBilan = 'BRUT' | 'NET';
export type LectureCompte = 'SOLDE_GESTION' | 'MOUVEMENT_DEBIT' | 'MOUVEMENT_CREDIT' | 'VARIATION_SOLDE';
export type SensSolde = 'DEBITEUR' | 'CREDITEUR';
export interface TermePoste {
    etat: EtatSource;
    ref: string;
    lecture: LecturePoste;
    colonne?: ColonneBilan;
}
export interface TermeComptes {
    prefixes: string[];
    exclusions?: string[];
    lecture: LectureCompte;
    sensSolde?: SensSolde;
    liaison?: 'REEVALUATION';
}
export interface TermeFluxTresorerie {
    signe: 1 | -1;
    poste?: TermePoste;
    comptes?: TermeComptes;
    motif: string;
}
export type SectionFlux = 'OUVERTURE' | 'OPERATIONNEL' | 'INVESTISSEMENT' | 'CAPITAUX_PROPRES' | 'CAPITAUX_ETRANGERS';
export type SigneModeleFlux = '+' | '-' | '';
export type SigneAttenduFlux = 'POSITIF' | 'NEGATIF' | 'LIBRE';
export interface PosteFluxTresorerieSyscohada {
    ref: string;
    libelle: string;
    section: SectionFlux;
    signeModele: SigneModeleFlux;
    signeAttendu: SigneAttenduFlux;
    renvoi?: string;
    termes: TermeFluxTresorerie[];
    nonDeterminables?: {
        comptes: string[];
        motif: string;
        declencheur?: {
            comptes: string[];
            sens: 'DEBIT' | 'CREDIT';
        };
    }[];
    note?: string;
}
export declare const RENVOI_1_TFT_SYSCOHADA: string;
export declare const POSTE_TRESORERIE_OUVERTURE_SYSCOHADA: PosteFluxTresorerieSyscohada;
export declare const POSTES_OPERATIONNELS_SYSCOHADA: PosteFluxTresorerieSyscohada[];
export declare const POSTES_INVESTISSEMENT_SYSCOHADA: PosteFluxTresorerieSyscohada[];
export declare const POSTES_CAPITAUX_PROPRES_SYSCOHADA: PosteFluxTresorerieSyscohada[];
export declare const POSTES_CAPITAUX_ETRANGERS_SYSCOHADA: PosteFluxTresorerieSyscohada[];
export declare const TOUS_LES_POSTES_FLUX_SYSCOHADA: PosteFluxTresorerieSyscohada[];
export interface TotalFluxTresorerieSyscohada {
    ref: string;
    libelle: string;
    cle?: string;
    deRefs: string[];
}
export declare const TOTAUX_FLUX_SYSCOHADA: TotalFluxTresorerieSyscohada[];
export declare const CONTROLE_ZH_PAR_LES_FLUX: string[];
export declare const CONTROLE_ZH_PAR_LE_BILAN: TermeFluxTresorerie[];
export declare const ORDRE_AFFICHAGE_FLUX_SYSCOHADA: Array<{
    ref: string;
} | {
    section: string;
}>;
export declare function trouvePosteFluxSyscohada(ref: string): PosteFluxTresorerieSyscohada | undefined;
export declare function trouveTotalFluxSyscohada(ref: string): TotalFluxTresorerieSyscohada | undefined;
export declare function besoinsDuPoste(p: PosteFluxTresorerieSyscohada): {
    exerciceN1: boolean;
    soldesAnterieurs: boolean;
    mouvements: boolean;
};
export declare function signeConformeAuModeleFlux(p: PosteFluxTresorerieSyscohada, montant: number): boolean;
export declare function postesLisantEnMouvement(numero: string): string[];
export declare function comptesCitesParLeTftSyscohada(): {
    ref: string;
    prefixe: string;
}[];
export declare const COMPTES_SANS_TRESORERIE_SYSCOHADA: {
    prefixe: string;
    motif: string;
}[];
export declare const COMPTES_TFT_NON_VENTILES_JUSTIFIES: {
    prefixe: string;
    anomalie: number;
    motif: string;
}[];
export declare const COMPTES_EXCLUS_SANS_REPRISE: {
    prefixe: string;
    anomalie: number;
    motif: string;
}[];
