import { PrismaService } from '../../common/prisma.service';
export declare class QuestionnairePaieService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lire(tenantId: string, salarieId: string | undefined, mois: string | undefined): Promise<{
        dossier: {
            effectifPermanent: number;
            numeroAffiliationCnssEmployeur: string | null;
        };
        salarie: null;
    } | {
        dossier: {
            effectifPermanent: number;
            numeroAffiliationCnssEmployeur: string | null;
        };
        salarie: {
            id: string;
            nomComplet: string;
            numeroAffiliationCnss: string | null;
            modePaiement: import(".prisma/client").$Enums.ModePaiementSalaire | null;
            contrat: {
                id: string;
                type: import(".prisma/client").$Enums.TypeContratTravail;
                classeProfessionnelle: number | null;
                periodiciteRemuneration: import(".prisma/client").$Enums.PeriodiciteRemuneration | null;
                deviseRemuneration: string | null;
            } | null;
        };
    }>;
}
