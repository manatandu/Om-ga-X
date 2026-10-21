import { PrismaService } from '../../common/prisma.service';
import { LotVirementDto } from './lots-virement.dto';
export declare class LotsVirementService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        id: string;
        nom: string;
        journalId: string | null;
        lignes: {
            compteId: string;
            numero: string;
            intitule: string;
            montant: number;
        }[];
    }[]>;
    private verifier;
    private lignes;
    private conflit;
    creer(tenantId: string, auteur: string, dto: LotVirementDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        journalId: string | null;
        creePar: string;
    }>;
    modifier(tenantId: string, id: string, dto: LotVirementDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        journalId: string | null;
        creePar: string;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
