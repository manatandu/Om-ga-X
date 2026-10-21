import { PrismaService } from '../../../common/prisma.service';
import { CourrierService, ResultatMiseEnFile } from '../../courrier/courrier.service';
export interface Expediteur {
    tenantId: string;
    userId: string;
}
export declare class CourrielsEditeurService {
    private readonly prisma;
    private readonly courrier;
    constructor(prisma: PrismaService, courrier: CourrierService);
    envoyerLicence(qui: Expediteur, id: string, destinataire: string, destinataireNom?: string | null): Promise<ResultatMiseEnFile>;
    envoyerFacture(qui: Expediteur, factureAbonnementId: string, destinataire?: string | null): Promise<ResultatMiseEnFile>;
}
