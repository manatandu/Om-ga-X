import type { PrismaService } from '../../common/prisma.service';
type Lecteur = Pick<PrismaService, 'ligneEcriture'>;
export interface EcartNonConstate {
    lettrageId: string;
    code: string;
    compteNumero: string;
    ecart: number;
    aCheval?: boolean;
    denouement?: Date;
}
export declare function ecartsRealisesNonConstates(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
}): Promise<{
    ecarts: EcartNonConstate[];
}>;
export declare function motifClotureEcartsNonConstates(r: {
    ecarts: EcartNonConstate[];
}): string | null;
export {};
