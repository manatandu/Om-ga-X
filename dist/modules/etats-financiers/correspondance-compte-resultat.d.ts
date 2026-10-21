export type SensPoste = 'PRODUIT' | 'CHARGE';
export interface PosteCompteResultat {
    ref: string;
    libelle: string;
    sens: SensPoste;
    comptes: string[];
}
export declare const POSTES_PRODUITS: PosteCompteResultat[];
export declare const POSTES_CHARGES: PosteCompteResultat[];
export declare const POSTES_HAO: PosteCompteResultat[];
export declare const TOUS_LES_POSTES: PosteCompteResultat[];
export declare function posteDuCompte(numeroCompte: string): PosteCompteResultat | null;
