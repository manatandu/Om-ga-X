export type Ref = 'SYSCOHADA' | 'SYCEBNL';
export declare function supplementDeLaDotation(dotation: number, coefficientsAnterieurs: number[]): number;
export interface LigneEcartDuBien {
    id: string;
    compteEcart: string | null;
    ecart: number;
    provisionReprise: number;
    ecartImpute: number;
    ecartTransfere: number;
}
export type TraitementALaSortie = 'RESERVE' | 'REPRISE_861';
export interface SortDeLEcart {
    ligneId: string;
    compteEcart: string;
    montant: number;
    traitement: TraitementALaSortie;
}
export declare function sortDesEcarts(o: {
    lignes: LigneEcartDuBien[];
}): SortDeLEcart[];
export declare const RACINES_RESERVE_NON_DISTRIBUABLE: readonly ["111", "112", "1138"];
export declare const COMPTE_RESERVE_SYCEBNL = "11800000";
export declare function motifRefusCompteReserve(numero: string | null | undefined, referentiel?: Ref): string | null;
export declare function lignesSortDeLEcart(sorts: SortDeLEcart[]): {
    reserve: Array<{
        compteEcart: string;
        montant: number;
    }>;
    reprise: number;
};
export interface RubriquePoste {
    libelle: string;
    comptes?: readonly string[];
    exclusions?: readonly string[];
}
export declare function posteDuBien(numero: string, rubriques: readonly RubriquePoste[], correspond: (numero: string, prefixes: readonly string[], exclusions?: readonly string[]) => boolean): string;
export interface ReevaluationPortee {
    dateReevaluation: Date;
    coefficientRetenu: number;
    brutAvant: number;
    brutApres: number;
    amortissementsAvant: number;
    amortissementsApres: number;
}
export declare function vueDeLExercice(portees: ReevaluationPortee[], exercice: {
    dateDebut: Date;
    dateFin: Date;
}): {
    produitAnterieur: number;
    produitPosterieur: number;
    ajustementCumulExercice: number;
    cumulPosterieur: number;
    brutPosterieur: number;
};
