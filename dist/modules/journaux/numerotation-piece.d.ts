import { NumerotationPiece, Prisma, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
export declare const NUMEROTATION_DU_FICHIER: "CONTINUE_FICHIER";
export declare const NUMEROTATION_PAR_DEFAUT: "CONTINUE_JOURNAL";
export declare function porteLaSequenceDuFichier(journal: {
    numerotation: NumerotationPiece;
    type?: TypeJournal;
}): boolean;
export declare function journauxDeLaSequenceDuFichier<J extends {
    numerotation: NumerotationPiece;
    type?: TypeJournal;
}>(journaux: J[]): J[];
export declare function modeEffectif(journal: {
    numerotation: NumerotationPiece;
    type?: TypeJournal;
}): NumerotationPiece;
export declare function prochainNumeroPiece(tx: Prisma.TransactionClient | PrismaService, tenantId: string, journal: {
    id: string;
    numerotation: NumerotationPiece;
    type?: TypeJournal;
}, exerciceId: string, date: Date): Promise<number | null>;
export declare function numeroteurDeLot(tx: Prisma.TransactionClient | PrismaService, tenantId: string, exerciceId: string): (journal: {
    id: string;
    numerotation: NumerotationPiece;
    type?: TypeJournal;
}, date: Date) => Promise<number | null>;
