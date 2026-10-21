export declare function lireDateDuFiltre(texte: string): Date | null;
export declare const enEntier: ({ value }: {
    value: unknown;
}) => unknown;
export declare const PAGE_JOURNAL_MAX: number;
export declare class FiltreJournalAuditDto {
    entite?: string;
    entiteId?: string;
    acteurEmail?: string;
    depuis?: Date;
    jusqua?: Date;
    page?: number;
    taille?: number;
}
