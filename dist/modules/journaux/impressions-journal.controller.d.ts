import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ImpressionsJournalService } from './impressions-journal.service';
import { ImprimerJournalDto } from './dto/impression-journal.dto';
export declare class ImpressionsJournalController {
    private readonly impressions;
    constructor(impressions: ImpressionsJournalService);
    lister(user: AuthenticatedUser, exerciceId: string): Promise<{
        impressions: {
            id: string;
            numero: number;
            journal: string | null;
            dateDebut: Date;
            dateFin: Date;
            forme: import(".prisma/client").$Enums.FormeImpressionJournal;
            nombreEcritures: number;
            imprimeAt: Date;
            imprimePar: string;
        }[];
        total: number;
        tronque: boolean;
    }>;
    imprimer(user: AuthenticatedUser, dto: ImprimerJournalDto): Promise<{
        id: string;
        tenantId: string;
        dateDebut: Date;
        numero: number;
        dateFin: Date;
        journalId: string | null;
        exerciceId: string;
        forme: import(".prisma/client").$Enums.FormeImpressionJournal;
        nombreEcritures: number;
        imprimeAt: Date;
        imprimePar: string;
    } | {
        numero: null;
        imprimeAt: null;
        nombreEcritures: null;
        motif: string;
    } | {
        numero: null;
        imprimeAt: null;
        nombreEcritures: number;
        motif: string;
    }>;
}
