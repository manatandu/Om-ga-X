import type { Prisma } from '@prisma/client';
import { MethodeAuReclassement, MethodeCotisationsDeclaree } from './creances-douteuses';
type Lecteur = Pick<Prisma.TransactionClient, 'evenementAudit'>;
export declare function lireMethodeAuReclassement(prisma: Lecteur, p: {
    tenantId: string;
    figee: 'APPEL' | 'ENCAISSEMENT' | 'NON_DECLAREE' | null | undefined;
    geste: Date;
    actuelle: MethodeCotisationsDeclaree;
}): Promise<MethodeAuReclassement>;
export {};
