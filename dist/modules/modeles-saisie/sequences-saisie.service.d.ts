import { PrismaService } from '../../common/prisma.service';
export declare class SequencesSaisieService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        nombreModeles: number;
        id: string;
        numero: number;
        intitule: string;
    }[]>;
    creer(tenantId: string, userId: string, intitule: string): Promise<{
        id: string;
        numero: number;
        intitule: string;
    }>;
    renommer(tenantId: string, id: string, intitule: string): Promise<{
        id: string;
        numero: number;
        intitule: string;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    private intituleDejaPris;
}
