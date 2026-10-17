import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma.service';
export type ObjetDesPieces = 'ECRITURE' | 'SECTION' | 'IMMOBILISATION' | 'SALARIE';
export type LecteurDesPieces = Prisma.TransactionClient | PrismaService;
export interface ObjetLu {
    description: string;
    motifRefusDepot: string | null;
    motifRefusRetrait: string | null;
    motifHorsPerimetre?: string | null;
}
export interface RegleDesPieces {
    objet: ObjetDesPieces;
    designation: string;
    lireObjet(db: LecteurDesPieces, tenantId: string, objetId: string): Promise<ObjetLu | null>;
    verrouiller?(db: LecteurDesPieces, tenantId: string, objetId: string): Promise<void>;
    motifHorsPerimetreDetachee?(): string | null;
}
export declare const TABLES_DES_PIECES: Readonly<Record<ObjetDesPieces, {
    delegue: string;
    colonne: string;
}>>;
export declare const PLAFOND_PIECES_PAR_LISTE = 200;
