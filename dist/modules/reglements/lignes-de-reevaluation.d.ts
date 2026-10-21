import type { PrismaService } from '../../common/prisma.service';
type Lecteur = Pick<PrismaService, 'reevaluation' | 'ligneEcriture'>;
export declare function lignesDeReevaluationSurLesTiers(prisma: Lecteur, p: {
    tenantId: string;
    exercice: {
        id: string;
        dateDebut: Date;
    };
    compteIds: string[];
}): Promise<Set<string>>;
export {};
