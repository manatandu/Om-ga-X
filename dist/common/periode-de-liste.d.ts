export interface PeriodeDeListe {
    du: string | null;
    au: string | null;
    bornes: {
        gte?: Date;
        lt?: Date;
    } | undefined;
}
export declare function lirePeriodeDeListe(filtre?: {
    du?: string | null;
    au?: string | null;
}): PeriodeDeListe;
