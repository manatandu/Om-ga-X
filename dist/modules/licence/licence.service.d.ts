import { PrismaService } from '../../common/prisma.service';
import { Licence } from '@prisma/client';
import { LicenceSurSiteService } from '../sur-site/licence-sur-site.service';
export declare class LicenceService {
    private readonly prisma;
    private readonly surSite?;
    constructor(prisma: PrismaService, surSite?: LicenceSurSiteService | undefined);
    estAccesAutorise(tenantId: string): Promise<{
        autorise: boolean;
        motif?: string;
        lectureSeule?: boolean;
    }>;
    evaluerLicence(licence: Licence | null): {
        autorise: boolean;
        motif?: string;
        lectureSeule?: boolean;
    };
    enregistrerHeartbeat(tenantId: string): Promise<void>;
}
