import type { Prisma } from '@prisma/client';
export interface EcartChangeNonPasse {
    lettrageId: string;
    code: string;
    compteId: string;
    ecart: number;
    libelle: string;
}
export interface LigneLueDuGroupe {
    id: string;
    lettrageId: string | null;
    debit: Prisma.Decimal | number;
    credit: Prisma.Decimal | number;
    deviseId: string | null;
    montantDevise: Prisma.Decimal | number | null;
}
export declare function libelleEcartNonPasse(ecart: number): string;
export declare function candidatsSoldesEnDevise(lues: readonly LigneLueDuGroupe[]): Map<string, {
    lignes: number;
    ecart: number;
}>;
export declare function groupesSoldesEnDevise(db: unknown, tenantId: string, lues: readonly LigneLueDuGroupe[]): Promise<Map<string, EcartChangeNonPasse>>;
