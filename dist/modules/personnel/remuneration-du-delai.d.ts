export declare const JOURS_DU_MOIS_REMUNERES = 26;
export declare const plusMois: (d: Date, n: number) => Date;
export type DelaiDePreavis = {
    readonly du: string;
    readonly auExclu: string | null;
};
export declare function debutDuDelai(dateNotification: string | null | undefined): {
    du: string;
} | {
    refus: string;
};
export type RemunerationDuDelai = {
    readonly joursRemuneres: number;
    readonly joursFeriesRemuneres: number;
    readonly moisEntiers: number | null;
    readonly joursDuMoisEntame: number | null;
    readonly montantFc: number;
    readonly du: string | null;
    readonly au: string | null;
    readonly explication: string;
};
export declare const REGLE_MOIS_ENTAME: string;
export declare function remunerationDuDelai(p: {
    readonly delai: DelaiDePreavis;
    readonly joursOuvrables: number;
    readonly de: number;
    readonly a: number;
    readonly journaliereFc: number | null;
    readonly mensuelleFc: number | null;
    readonly moyenneMensuelleFc: number;
}): RemunerationDuDelai | {
    refus: string;
};
