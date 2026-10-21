export declare const MARQUEUR_CANEVAS = "OMEGAX-CANEVAS-V1";
export type SensRubrique = 'recette' | 'depense';
export interface RubriqueCanevas {
    libelle: string;
    compte: string;
    sens: SensRubrique;
}
export declare const RUBRIQUES_CANEVAS: RubriqueCanevas[];
export declare const TRESORERIES_CANEVAS: Record<string, {
    compte: string;
    journal: 'CA' | 'BQ';
}>;
export declare const PREMIERE_LIGNE_DONNEES = 6;
export declare const DERNIERE_LIGNE_DONNEES = 505;
