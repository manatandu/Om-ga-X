import { PrismaService } from '../prisma.service';
export declare const TAILLE_PAGE_JOURNAL_DEFAUT = 50;
export declare const TAILLE_PAGE_JOURNAL_MAX = 200;
export interface FiltreJournal {
    entite?: string;
    entiteId?: string;
    acteurEmail?: string;
    depuis?: Date;
    jusqua?: Date;
    page?: number;
    taille?: number;
}
export interface RuptureChaine {
    rang: number;
    id: string;
    motif: 'RANG_MANQUANT' | 'CHAINAGE_ROMPU' | 'EMPREINTE_INVALIDE';
}
export interface VerdictChaine {
    evenements: number;
    intacte: boolean;
    ruptures: RuptureChaine[];
}
export declare function instantTransmissible(date: Date): boolean;
export declare const CARACTERE_NUL = "\0";
export declare function motifFiltreIllisible(filtre: FiltreJournal): string | null;
export declare class JournalAuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string, filtre: FiltreJournal): Promise<{
        total: number;
        page: number;
        taille: number;
        evenements: {
            rang: number;
            empreinte: string;
            id: string;
            tenantId: string | null;
            entiteId: string | null;
            horodatage: Date;
            acteurId: string | null;
            acteurEmail: string;
            adresseIp: string | null;
            action: import(".prisma/client").$Enums.ActionAudit;
            entite: string;
            avant: import("@prisma/client/runtime/library").JsonValue | null;
            apres: import("@prisma/client/runtime/library").JsonValue | null;
            empreintePrecedente: string;
        }[];
    }>;
    verifier(tenantId: string | null): Promise<VerdictChaine>;
    private verifierLot;
}
