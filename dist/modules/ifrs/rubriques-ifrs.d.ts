export type SectionSituation = 'ACTIF_NON_COURANT' | 'ACTIF_COURANT' | 'CAPITAUX_PROPRES' | 'PASSIF_NON_COURANT' | 'PASSIF_COURANT';
export type CategorieResultat = 'OPERATIONNELLE' | 'INVESTISSEMENT' | 'FINANCEMENT' | 'IMPOTS' | 'ABANDONNEES';
export type CategorieOci = 'OCI_NON_RECYCLABLE' | 'OCI_RECYCLABLE';
export interface RubriqueIfrs {
    code: string;
    libelle: string;
    ref: string;
    etat: 'SITUATION' | 'RESULTAT' | 'RESULTAT_GLOBAL';
    section?: SectionSituation;
    categorie?: CategorieResultat;
    categorieOci?: CategorieOci;
}
export declare const RUBRIQUES_IFRS: RubriqueIfrs[];
export declare const RUBRIQUE_PAR_CODE: Map<string, RubriqueIfrs>;
export declare const RUBRIQUE_NCI = "SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE";
export declare const LIBELLE_SECTION: Record<SectionSituation, string>;
export declare const LIBELLE_CATEGORIE_OCI: Record<CategorieOci, string>;
export declare const LIBELLE_CATEGORIE: Record<CategorieResultat, string>;
export declare function motifRefusRegle(prefixe: string, rubrique: string): string | null;
