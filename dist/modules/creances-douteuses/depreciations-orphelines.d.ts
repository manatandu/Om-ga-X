import type { Prisma } from '@prisma/client';
import { DepreciationOrpheline } from './creances-douteuses';
type Lecteur = Pick<Prisma.TransactionClient, 'exercice' | 'creanceDouteuse'>;
export declare function depreciationsOrphelines(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
}): Promise<DepreciationOrpheline[]>;
export {};
