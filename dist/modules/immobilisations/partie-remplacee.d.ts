export type MethodeEstimationPartie = 'COUT_ACTUEL_A_NEUF' | 'POURCENTAGE_IMMOBILISATIONS_RECENTES' | 'INFORMATIONS_FOURNISSEURS' | 'DEPENSES_DE_RENOUVELLEMENT';
export declare const LIBELLE_METHODE_PARTIE: Record<MethodeEstimationPartie, string>;
export declare const AVERTISSEMENT_DEPENSES_RENOUVELLEMENT = "Estim\u00E9e sur la d\u00E9pense de renouvellement, la partie remplac\u00E9e \u00AB pourrait \u00BB \u00EAtre sur\u00E9valu\u00E9e (AUDCIF Titre VIII ch. 4 \u00A7 3.1.2) \u00B7 v\u00E9rifiez que la structure garde une valeur coh\u00E9rente avec ce qu'elle porte encore.";
export interface StructureADecomposer {
    valeurOrigine: number;
    valeurResiduelle: number;
    cumulOuverture: number;
    estComposant: boolean;
    modeLineaire: boolean;
    cumulDepreciation: number;
    degressifOuDerogatoire: boolean;
    financeeParUnFonds: boolean;
    dotationDejaPassee: boolean;
    enService: boolean;
}
export declare function detacherPartieRemplacee(s: StructureADecomposer, o: {
    valeurEstimee: number;
    methode: MethodeEstimationPartie;
    source: string;
}): {
    valeurPartie: number;
    amortissementsPartie: number;
    avertissement: string | null;
} | {
    motif: string;
};
export declare function amortissementsHorsDotations(i: {
    amortissementAnterieur: unknown;
    amortissementsDetaches?: unknown;
    reprisesAmortissement?: unknown;
    amortissementsReevaluation?: unknown;
}): number;
