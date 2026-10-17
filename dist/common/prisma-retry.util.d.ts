import { Prisma } from '@prisma/client';
export declare function estConflitDeSerialisation(err: unknown): boolean;
export declare const DELAI_BASE_MS = 10000;
export declare const DELAI_PAR_OPERATION_MS = 50;
export declare const DELAI_MAX_MS = 240000;
export declare function delaiSelonVolume(operations: number): number;
export declare function avecRetrySerialisable<T>(prisma: {
    $transaction: <R>(fn: (tx: Prisma.TransactionClient) => Promise<R>, opts?: any) => Promise<R>;
}, fn: (tx: Prisma.TransactionClient) => Promise<T>, messageConflit: string, options?: {
    operations?: number;
}): Promise<T>;
