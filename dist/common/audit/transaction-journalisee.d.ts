import { Prisma } from '@prisma/client';
export type ClientTransactionnel = {
    $transaction: <R>(fn: (tx: Prisma.TransactionClient) => Promise<R>, options?: OptionsTransaction) => Promise<R>;
};
export type OptionsTransaction = {
    isolationLevel?: Prisma.TransactionIsolationLevel;
    maxWait?: number;
    timeout?: number;
};
export declare function transactionJournalisee<T>(prisma: ClientTransactionnel, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: OptionsTransaction): Promise<T>;
