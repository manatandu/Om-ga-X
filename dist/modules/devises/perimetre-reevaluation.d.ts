import { Referentiel } from '@prisma/client';
export declare function seReevalueALaCloture(numero: string, referentiel: Referentiel): boolean;
export declare function motifHorsReevaluation(numero: string, referentiel: Referentiel): string | null;
export declare function motifPositionDenouee(montantDevise: number, valeurComptable: number): string | null;
export interface LigneDeGroupe {
    lettrageId: string;
    code: string;
    debit: number;
    credit: number;
    deviseId: string | null;
    montantDevise: number | null;
}
export declare function groupesDenoues(lignes: LigneDeGroupe[]): Map<string, {
    code: string;
    ecart: number;
}>;
export interface LigneDeGroupeDatee<C> extends LigneDeGroupe {
    compteId: string;
    compte: C;
    devise: {
        id: string;
        code: string;
    } | null;
    ecriture: {
        exerciceId: string;
        date: Date;
    };
}
export declare function lectureDesGroupes<T extends LigneDeGroupeDatee<unknown>>(lignes: T[], p: {
    exerciceId: string;
    date: Date;
}): {
    aCheval: Set<string>;
    lignesEnFrancs: T[];
    deviseDuGroupe: Map<string, {
        id: string;
        code: string;
    }>;
    denouesACheval: Map<string, {
        code: string;
        ecart: number;
    }>;
};
export declare function positionDesLignes(lignes: Array<{
    debit: number;
    credit: number;
    montantDevise: number | null;
}>): {
    montantDevise: number;
    valeurComptable: number;
};
export declare function motifDateReevaluation(date: string, dateFin: Date): string | null;
