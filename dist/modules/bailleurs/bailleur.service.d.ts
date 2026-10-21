import { PrismaService } from '../../common/prisma.service';
import { CreerBailleurDto, ModifierBailleurDto } from './dto/bailleur.dto';
export declare class BailleurService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string, actifsSeuls?: boolean): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        code: string;
    }[]>;
    creer(tenantId: string, dto: CreerBailleurDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        code: string;
    }>;
    modifier(tenantId: string, bailleurId: string, dto: ModifierBailleurDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        code: string;
    }>;
}
