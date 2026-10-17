import { PrismaService } from '../../common/prisma.service';
import { CreerOdAnalytiqueDto } from './dto/od-analytique.dto';
export declare class OdAnalytiqueService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string, exerciceId: string, planId?: string): Promise<{
        id: string;
        date: string;
        reference: string | null;
        libelle: string;
        planId: string;
        plan: {
            intitule: string;
            code: string;
        };
        compte: {
            numero: string;
            intitule: string;
        };
        montant: number;
        lignes: {
            sectionId: string;
            sectionCode: string;
            sectionIntitule: string;
            debit: number;
            credit: number;
        }[];
    }[]>;
    creer(tenantId: string, userId: string, dto: CreerOdAnalytiqueDto): Promise<{
        id: string;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    refuserSiPeriodeClose(tenantId: string, date: Date): Promise<void>;
    cumulsParSection(tenantId: string, planId: string, exerciceId: string, du: Date, au: Date): Promise<Map<string, {
        debit: number;
        credit: number;
    }>>;
}
