export declare const METHODES_ADMISES: readonly ["PEPS", "CMPACE", "CMP_PERIODE_STOCKAGE"];
export type MethodeValorisation = (typeof METHODES_ADMISES)[number];
export declare const METHODES_INVENTAIRE_PERMANENT: MethodeValorisation[];
export declare const METHODES_INVENTAIRE_INTERMITTENT: MethodeValorisation[];
export interface MouvementAValoriser {
    ordre: number;
    date: string;
    sens: 'ENTREE' | 'SORTIE';
    quantite: number;
    cout: number | null;
}
export interface MouvementValorise extends MouvementAValoriser {
    valeur: number;
    quantiteApres: number;
    valeurApres: number;
}
export type MotifRefusValorisation = 'METHODE_SANS_MOUVEMENTS' | 'ENTREE_SANS_COUT' | 'ENTREE_COUT_NEGATIF' | 'SORTIE_AVEC_COUT_IMPOSE' | 'QUANTITE_NON_POSITIVE' | 'SORTIE_SUPERIEURE_AU_STOCK' | 'METHODE_NON_IMPLEMENTEE';
export interface RefusValorisation {
    ordre: number | null;
    motif: MotifRefusValorisation;
    explication: string;
}
export interface Valorisation {
    methode: MethodeValorisation;
    mouvements: MouvementValorise[];
    quantiteFinale: number;
    valeurFinale: number;
    totalEntrees: number;
    totalSorties: number;
    refus: RefusValorisation[];
}
export declare function valoriser(mouvementsBruts: MouvementAValoriser[], methode: MethodeValorisation): Valorisation;
export declare function methodeCompatible(methode: MethodeValorisation, inventaire: 'PERMANENT' | 'INTERMITTENT'): boolean;
export declare function sortiesAuDelaDuStock(mouvements: MouvementAValoriser[]): RefusValorisation[];
