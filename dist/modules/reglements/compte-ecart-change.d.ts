import type { PrismaService } from '../../common/prisma.service';
import { type NatureCreanceDette, type Referentiel } from './ecart-change-realise';
type Lecteur = Pick<PrismaService, 'compte' | 'tenant'>;
export declare function referentielDuDossier(prisma: Lecteur, tenantId: string): Promise<Referentiel>;
export declare function compteDeLEcart(prisma: Lecteur, p: {
    tenantId: string;
    referentiel: Referentiel;
    nature: NatureCreanceDette | null;
    ecart: 'PERTE' | 'GAIN';
    choisiId?: string | null;
}): Promise<{
    id: string;
    numero: string;
}>;
export {};
