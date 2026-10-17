import { Prisma, SensVirementFonds } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
type Client = PrismaService | Prisma.TransactionClient;
export declare function assurerComptesDePassage(client: Client, tenantId: string): Promise<Record<SensVirementFonds, {
    id: string;
    numero: string;
    intitule: string;
}>>;
export {};
