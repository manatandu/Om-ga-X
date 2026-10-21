import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
export interface DemandeComptabilisation {
    journalId: string;
    compteGestionId: string | null;
    comptesParLigne?: Record<string, string>;
    dateReception?: string | null;
}
export declare class ComptabilisationFactureService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    comptabiliser(tenantId: string, userId: string, factureId: string, d: DemandeComptabilisation): Promise<{
        avertissement?: string | undefined;
        ecritureId: string;
        lignes: number;
        date: string;
    }>;
}
