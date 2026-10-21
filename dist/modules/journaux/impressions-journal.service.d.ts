import { PrismaService } from '../../common/prisma.service';
import { ImprimerJournalDto } from './dto/impression-journal.dto';
export declare const PLAFOND_IMPRESSIONS_LISTEES = 200;
export declare class ImpressionsJournalService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    imprimer(tenantId: string, userId: string, dto: ImprimerJournalDto): Promise<{
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
    lister(tenantId: string, exerciceId: string): Promise<{
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
}
