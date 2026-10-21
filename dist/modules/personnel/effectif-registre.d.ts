import { PrismaService } from '../../common/prisma.service';
export declare function effectifDuRegistre(prisma: PrismaService, tenantId: string, ala: Date): Promise<{
    ala: Date;
    effectif: number;
    hommes: number;
    femmes: number;
    permanents: number;
    nationaux: number;
    sansNationalite: number;
    partMainOeuvreNationale: number | null;
    source: string;
    reserve: string | null;
}>;
