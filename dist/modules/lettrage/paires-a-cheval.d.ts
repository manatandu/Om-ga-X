import type { Prisma } from '@prisma/client';
export interface ResteDeLaLigne {
    francs: number;
    devise: number | null;
    groupe: string;
}
export interface PairesACheval {
    absorbees: Set<string>;
    groupeDe: Map<string, string>;
    reste: Map<string, ResteDeLaLigne>;
}
export declare const ECRITURE_D_A_NOUVEAU: Prisma.EcritureWhereInput[];
export declare function pairesACheval(prisma: unknown, p: {
    tenantId: string;
    exercice: {
        id: string;
        dateDebut: Date;
    };
    compte: Prisma.CompteWhereInput;
}): Promise<PairesACheval>;
