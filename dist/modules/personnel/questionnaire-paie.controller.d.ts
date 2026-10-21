import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { QuestionnairePaieService } from './questionnaire-paie.service';
export declare class QuestionnairePaieController {
    private readonly questionnaire;
    constructor(questionnaire: QuestionnairePaieService);
    lire(user: AuthenticatedUser, salarieId?: string, mois?: string): Promise<{
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
