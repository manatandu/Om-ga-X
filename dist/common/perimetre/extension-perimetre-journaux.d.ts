import { type PrismaClient } from '@prisma/client';
export type EcritureCiblee = {
    journalId: string | null | undefined;
};
export declare function journalHorsPerimetre(journalId: string | null | undefined, autorises: readonly string[] | null | undefined): boolean;
export declare const MESSAGE_HORS_PERIMETRE = "Ce journal n'est pas dans votre p\u00E9rim\u00E8tre de saisie \u00B7 l'administrateur du dossier a restreint vos \u00E9critures aux journaux coch\u00E9s dans la fen\u00EAtre Utilisateurs.";
export declare function garderPerimetreJournaux(base: PrismaClient, contexte: {
    model: string;
    operation: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
}): Promise<unknown>;
export declare function extensionPerimetreJournaux(base: PrismaClient): (client: any) => {
    $extends: {
        extArgs: import("@prisma/client/runtime/library").InternalArgs<unknown, unknown, {}, unknown>;
    };
};
