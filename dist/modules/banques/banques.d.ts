import { TypeJournal } from '@prisma/client';
export declare function normaliserIban(iban: string): string;
export declare function ibanValide(brut: string): boolean;
export declare function motifRefusJournalBanque(journal: {
    code: string;
    type: TypeJournal;
    compteTresorerie: {
        numero: string;
    } | null;
} | null): string | null;
