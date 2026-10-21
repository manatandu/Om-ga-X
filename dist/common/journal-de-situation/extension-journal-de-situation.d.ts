import { type PrismaClient } from '@prisma/client';
export declare const MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL: string;
export declare function messageJournalDeSituation(code: string): string;
export declare function motifEcartJournalDeSituation(journal: {
    situation: boolean;
    code: string;
}, statut: string): string | null;
export declare function garderJournalDeSituation(base: PrismaClient, contexte: {
    model: string;
    operation: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
}): Promise<unknown>;
export declare function extensionJournalDeSituation(base: PrismaClient): (client: any) => {
    $extends: {
        extArgs: import("@prisma/client/runtime/library").InternalArgs<unknown, unknown, {}, unknown>;
    };
};
