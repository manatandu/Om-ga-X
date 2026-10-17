import { PrismaClient } from '@prisma/client';
export declare function filtreBorne(where: unknown, dossier?: string | null, perimetre?: ReadonlySet<string>): boolean;
export declare function garderCloisonnement(base: PrismaClient, contexte: {
    model: string;
    operation: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
}): Promise<unknown>;
export declare function extensionCloisonnement(base: PrismaClient): (client: any) => {
    $extends: {
        extArgs: import("@prisma/client/runtime/library").InternalArgs<unknown, unknown, {}, unknown>;
    };
};
