import { ActionAudit, PrismaClient } from '@prisma/client';
export declare function selectPreImage(model: string): {
    select?: Record<string, true>;
};
export declare function ajouterMaillon(base: PrismaClient, evenement: {
    tenantId: string | null;
    acteurId: string | null;
    acteurEmail: string;
    adresseIp: string | null;
    action: ActionAudit;
    entite: string;
    entiteId: string | null;
    avant: unknown;
    apres: unknown;
}): Promise<{
    rang: number;
    empreinte: string;
}>;
export declare class ErreurMaillonDansTransaction extends Error {
    constructor(model: string, operation: string, cause: unknown);
}
export declare function intercepterEcriture(base: PrismaClient, contexte: {
    model: string;
    operation: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
}): Promise<unknown>;
export declare function extensionAudit(base: PrismaClient): (client: any) => {
    $extends: {
        extArgs: import("@prisma/client/runtime/library").InternalArgs<unknown, unknown, {}, unknown>;
    };
};
