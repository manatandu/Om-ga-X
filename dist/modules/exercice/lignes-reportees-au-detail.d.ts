import { Prisma } from '@prisma/client';
export declare function lignesReporteesAuDetail(ecriture: Prisma.EcritureWhereInput & {
    tenantId: string;
    exerciceId: string;
}): Prisma.LigneEcritureWhereInput & {
    OR: Prisma.LigneEcritureWhereInput[];
};
