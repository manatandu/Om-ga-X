import { GranulariteCloture } from '@prisma/client';
export interface ClotureActive {
    granularite: GranulariteCloture;
    journalId: string | null;
    dateLimite: Date;
}
export declare function premierJourNonCloture(clotures: ClotureActive[], journalId: string, date: Date): Date;
