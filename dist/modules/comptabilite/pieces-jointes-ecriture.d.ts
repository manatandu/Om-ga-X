import { Prisma, StatutEcriture } from '@prisma/client';
import type { LecteurDesPieces, ObjetLu, RegleDesPieces } from '../../common/pieces-jointes/table-des-pieces';
export interface EcritureDesPieces {
    statut: StatutEcriture;
    estANouveauProvisoire: boolean;
    numeroPiece: number | null;
    date: Date;
    libelle: string;
    journal: {
        code: string;
    };
}
export declare function descriptionDeLEcriture(e: EcritureDesPieces): string;
export declare function motifRefusDepotEcriture(e: EcritureDesPieces): string | null;
export declare function motifRefusRetraitEcriture(e: EcritureDesPieces): string | null;
export declare function motifHorsPerimetreEcriture(journal: {
    id: string | null;
    code: string | null;
}): string | null;
export declare function lireEcritureDesPieces(db: LecteurDesPieces, tenantId: string, ecritureId: string): Promise<ObjetLu | null>;
export declare function verrouillerEcriture(db: LecteurDesPieces, tenantId: string, ecritureId: string): Promise<void>;
export declare const REGLE_PIECES_ECRITURE: RegleDesPieces;
export declare function reporterLesPieces(tx: Prisma.TransactionClient, tenantId: string, ancienneId: string, nouvelleId: string): Promise<number>;
export declare function retoucherDescriptionDesPieces(tx: Prisma.TransactionClient, tenantId: string, ecritureId: string): Promise<number>;
export declare function preparerLesPiecesADetacher(tx: Prisma.TransactionClient, tenantId: string, ecritureId: string): Promise<number>;
