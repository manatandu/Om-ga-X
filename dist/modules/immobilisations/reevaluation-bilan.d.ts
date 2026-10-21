export type Ref = 'SYSCOHADA' | 'SYCEBNL';
export type TypeReevaluation = 'LEGALE' | 'LIBRE';
export type MethodeLibre = 'AJUSTEMENT' | 'ELIMINATION';
export type NatureReevaluable = 'CORPORELLE' | 'FINANCIERE';
export type BaseCoefficient = 'ORIGINE' | 'DERNIERE_REEVALUATION';
export declare const COMPTE_REPRISE_PROVISION_SPECIALE = "86100000";
export declare const COMPTE_PROVISION_SPECIALE = "15400000";
export declare function natureReevaluable(numeroCompte: string, referentiel: Ref): NatureReevaluable | null;
export declare const RACINES_ELEMENTS_MONETAIRES: string[];
export declare function estElementMonetaire(numeroCompte: string): boolean;
export declare function estBienRecuDestineALaVente(numeroCompte: string, referentiel: Ref): boolean;
export declare function compteEcart(o: {
    referentiel: Ref;
    type: TypeReevaluation;
    neutraliteFiscale: boolean;
    nature: NatureReevaluable;
    amortissable: boolean;
    droitDeReprise: boolean | null | undefined;
}): {
    compte: string;
} | {
    motif: string;
};
export interface BienAReevaluer {
    id: string;
    designation: string;
    numeroCompte: string;
    valeurOrigine: number;
    valeurResiduelle: number;
    cumulAmortissements: number;
    cumulDepreciation: number;
    amortissable: boolean;
    lineaire: boolean;
    anneesRestantes: number | null;
    planCommence: boolean;
    coefficientsAnterieurs: number[];
}
export interface SaisieBien {
    categorie?: string | null;
    valeurActuelle?: number | null;
    droitDeReprise?: boolean | null;
}
export interface Operation {
    referentiel: Ref;
    type: TypeReevaluation;
    methodeLibre: MethodeLibre | null;
    neutraliteFiscale: boolean;
    coefficients: Record<string, number>;
    bases: Record<string, BaseCoefficient | null | undefined>;
}
export interface ResultatBien {
    id: string;
    designation: string;
    nature: NatureReevaluable;
    valeurNetteAvant: number;
    coefficient: number | null;
    coefficientDeclare: number | null;
    produitAnterieur: number;
    coefficientRetenu: number;
    valeurReevaluee: number;
    brutApres: number;
    amortissementsApres: number;
    valeurResiduelleApres: number;
    deltaBrut: number;
    deltaAmortissements: number;
    ecart: number;
    compteEcart: string | null;
    motifNonReevalue: string | null;
}
export declare const MOTIF_DEPRECIE: string;
export declare const MOTIF_DIVISION_20: string;
export declare const MOTIF_ELEMENT_MONETAIRE: string;
export declare const MOTIF_VALEUR_NETTE_NULLE: string;
export declare function produitCoefficients(coefficients: number[]): number;
export declare function coefficientApplique(o: {
    coefficient: number;
    base: BaseCoefficient | null | undefined;
    produitAnterieur: number;
}): {
    coefficient: number;
} | {
    refus: string;
};
export declare function reevaluerBien(bien: BienAReevaluer, saisie: SaisieBien, op: Operation): ResultatBien | {
    refus: string;
};
export declare function lignesBien(r: ResultatBien, methode: 'AJUSTEMENT' | 'ELIMINATION'): Array<{
    role: 'BIEN' | 'AMORTISSEMENT' | 'ECART';
    debit: number;
    credit: number;
}>;
export declare function anneesRestantes(o: {
    dureeAns: number;
    valeurOrigine: number;
    valeurResiduelle: number;
    valeurNette: number;
    revision: {
        effet: Date;
        dureeResiduelleAns: number;
    } | null;
    ouvertureSuivante: Date;
}): number | null;
export declare function supplementDotation(o: {
    dotation: number;
    coefficientRetenu: number;
    produitPosterieur: number;
    resteProvision: number;
}): number;
export declare function partsDuSupplement(dotation: number, chaine: Array<{
    id: string;
    coefficientRetenu: number;
    resteProvision: number;
    provisionSpeciale: boolean;
}>): Array<{
    id: string;
    produitPosterieur: number;
    montant: number;
}>;
export declare function imputationSurEcart(montant: number, ecarts: Array<{
    id: string;
    compteEcart: string;
    reste: number;
}>): {
    parEcart: Array<{
        id: string;
        compteEcart: string;
        montant: number;
    }>;
    enCharge: number;
};
