import type { PrismaService } from '../../common/prisma.service';
import { type Referentiel } from './ecart-change-realise';
type Lecteur = Pick<PrismaService, 'ligneEcriture'>;
export declare const PLAFOND_LIGNES_EXAMINEES = 20000;
export interface ReglementSansEcart {
    compteNumero: string;
    piece: string;
    date: Date;
    montantDevise: number;
    francsPortes: number;
    francsHistoriques: number;
    ecart: number;
}
export declare function reglementsSansEcart(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
    referentiel: Referentiel;
}): Promise<{
    elements: ReglementSansEcart[];
    tronque: boolean;
    nonReconnaissables: number;
}>;
export {};
