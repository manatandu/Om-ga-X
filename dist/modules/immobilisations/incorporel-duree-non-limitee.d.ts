export type FondementDureeDixAns = 'NON_ESTIMABLE' | 'SIMPLIFICATION_SMT';
export declare const INCORPORELS_TOUJOURS_AMORTIS: readonly {
    racine: string;
    motif: string;
}[];
export declare const JUSTIFICATION_PRESUMEE_FONDS_COMMERCIAL = "Fonds commercial \u00B7 dur\u00E9e d'utilit\u00E9 pr\u00E9sum\u00E9e non limit\u00E9e (AUDCIF Titre VIII ch. 2 \u00A7 7.2.2.1).";
export declare const MOTIF_NON_AMORTI = "Dur\u00E9e d'utilit\u00E9 non limit\u00E9e \u00B7 l'incorporel n'est pas amorti tant que sa dur\u00E9e n'a pas de fin pr\u00E9visible (AUDCIF Titre VIII ch. 2 \u00A7 4.2.2). La d\u00E9pr\u00E9ciation reste ouverte ; quand la dur\u00E9e devient limit\u00E9e, d\u00E9clarez-le.";
export declare const estFondsCommercial: (numero: string) => boolean;
export declare function motifRefusDureeNonLimitee(o: {
    referentiel: 'SYSCOHADA' | 'SYCEBNL';
    numeroCompte: string;
    justification?: string | null;
    nomDeDomaine?: boolean;
}): string | null;
export declare function motifRefusDureeDixAns(o: {
    numeroCompte: string;
    fondement: FondementDureeDixAns;
    dureeAns: number | null | undefined;
    systemeMinimal: boolean;
}): string | null;
export declare function motifRefusBascule(o: {
    dureeNonLimitee: boolean;
    enService: boolean;
    dateDecision: Date;
    debutPossible: Date | null;
    dureeResiduelleAns: number;
    testDepreciation: string | null | undefined;
    motif: string | null | undefined;
}): string | null;
export declare function debutAmortissement(i: {
    dateDebutAmortissement?: Date | null;
    dateMiseEnService: Date | null;
}): Date | null;
