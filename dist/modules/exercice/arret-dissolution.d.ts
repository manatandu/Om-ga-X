export interface ActeQuiSuitSonEcriture {
    modele: string;
    libelle: string;
    colonne: string;
    unicite: string[] | null;
    parLeBien?: true;
}
export declare const ACTES_QUI_SUIVENT_LEUR_ECRITURE: readonly ActeQuiSuitSonEcriture[];
export declare const ACTES_DATES_QUI_SUIVENT_LEUR_DATE: readonly ActeQuiSuitSonEcriture[];
export interface ActeDeLaPeriode {
    modele: string;
    libelle: string;
    colonne: string;
    parLeBien?: true;
    actif?: Record<string, null>;
    retirable?: true;
    issue?: string;
}
export declare const ACTES_DE_LA_PERIODE: readonly ActeDeLaPeriode[];
export interface ActeDeLaPeriodeLu {
    modele: string;
    id: string;
    libelle: string;
    piece: string;
    periode: string;
    retirable: boolean;
    ecritureId: string | null;
    issue: string;
}
export declare function issueActeDeLaPeriode(acte: ActeDeLaPeriode, etat: {
    auBrouillard: boolean;
    bienSorti: boolean;
}): string;
export declare function motifActesDeLaPeriode(actes: ActeDeLaPeriodeLu[]): string | null;
export interface EtatAvantArret {
    exercice: {
        dateDebut: Date;
        dateFin: Date;
        clos: boolean;
    };
    dissolution: Date | null;
    posterieurs: Array<{
        dateDebut: Date;
        dateFin: Date;
        clos: boolean;
        usages?: string | null;
    }>;
    sansLiquidation: boolean;
    ecrituresApres: number;
    actesDeLaPeriode: ActeDeLaPeriodeLu[];
}
export declare function motifRefusArret(e: EtatAvantArret): string | null;
export declare function motifActeQuiNePeutSuivre(acte: ActeQuiSuitSonEcriture, piece: string): string;
export declare function finDOrigineDeLExerciceArrete(dissolution: Date): Date;
