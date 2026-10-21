import { PrismaService } from '../../common/prisma.service';
import { CreerBailleurDto, ModifierBailleurDto } from './dto/bailleur.dto';
export declare class BailleurService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string, actifsSeuls?: boolean): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        code: string;
    }[]>;
    creer(tenantId: string, dto: CreerBailleurDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        code: string;
    }>;
    modifier(tenantId: string, bailleurId: string, dto: ModifierBailleurDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        code: string;
    }>;
}
