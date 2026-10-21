export type NatureMajoration = 'HEURES_SUPPLEMENTAIRES' | 'TRAVAIL_DE_NUIT' | 'TRAVAIL_REPOS_OU_FERIE';
export type DefinitionMajoration = {
    readonly libelle: string;
    readonly fondement: string;
    readonly heureEntiere: boolean;
};
export declare const NATURES_MAJORATION: Readonly<Record<NatureMajoration, DefinitionMajoration>>;
export declare const TAUX_MAJORATION_AU_PLUS = 1000;
export declare const HEURES_DU_MOIS_AU_PLUS = 744;
export declare function motifRefusMajoration(p: {
    nature: string;
    libelle: string;
    tauxPourCent: number;
    source: string;
    dateEffet: string;
}): string | null;
export declare function montantDesHeures(p: {
    nature: NatureMajoration;
    heures: number;
    tauxHoraire: number;
    tauxPourCent: number;
}): number;
export declare function libelleDesHeures(p: {
    nature: NatureMajoration;
    heures: number;
    tauxHoraire: number;
    tauxPourCent: number;
    libelleMajoration: string;
}): string;
