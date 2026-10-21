import { PrismaService } from './prisma.service';
export declare class SanteController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    sante(): Promise<{
        statut: string;
    }>;
}
