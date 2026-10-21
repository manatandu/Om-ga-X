import { PrismaService } from '../../common/prisma.service';
import { NumerotationPiece, Prisma, Referentiel, TypeJournal } from '@prisma/client';
import { CreerJournalDto, ModifierJournalDto } from './dto/journal.dto';
export declare class JournalService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    seedJournauxDefaut(tenantId: string, referentiel: Referentiel, client?: Prisma.TransactionClient): Promise<void>;
    lister(tenantId: string, actifsSeuls?: boolean): Promise<({
        compteTresorerie: {
            id: string;
            estActif: boolean;
            tenantId: string;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
            estRetenu: boolean;
            lettrable: boolean;
            collectifId: string | null;
            tauxTvaDefautId: string | null;
            codeRetraitementFiscal: string | null;
            comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
            partVariableGestionPct: Prisma.Decimal | null;
            bailleurId: string | null;
            porteFondsContrepartieEtat: boolean;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeJournal;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        compteTresorerieId: string | null;
        numerotation: import(".prisma/client").$Enums.NumerotationPiece;
        contrepartieChaqueLigne: boolean;
    })[]>;
    trouver(tenantId: string, journalId: string): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeJournal;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        compteTresorerieId: string | null;
        numerotation: import(".prisma/client").$Enums.NumerotationPiece;
        contrepartieChaqueLigne: boolean;
    }>;
    creer(tenantId: string, dto: CreerJournalDto): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeJournal;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        compteTresorerieId: string | null;
        numerotation: import(".prisma/client").$Enums.NumerotationPiece;
        contrepartieChaqueLigne: boolean;
    }>;
    comptesDuPlanPourJournal(tenantId: string): Promise<{
        id: string;
        numero: string;
        intitule: string;
    }[]>;
    compteDuJournalPropose(tenantId: string, sousId: string): Promise<{
        numero: string | null;
        racine: string;
        longueur: number;
        compteDuPlan: {
            numero: string;
            intitule: string;
        };
        motif: string | null;
    }>;
    private compteAOuvrir;
    private verifierCompteTresorerie;
    supprimer(tenantId: string, journalId: string): Promise<{
        supprime: boolean;
    }>;
    modifier(tenantId: string, journalId: string, dto: ModifierJournalDto): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeJournal;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        compteTresorerieId: string | null;
        numerotation: import(".prisma/client").$Enums.NumerotationPiece;
        contrepartieChaqueLigne: boolean;
    }>;
    prochainNumeroPiece(tenantId: string, journal: {
        id: string;
        numerotation: NumerotationPiece;
        type?: TypeJournal;
    }, exerciceId: string, date: Date, tx?: Prisma.TransactionClient | PrismaService): Promise<number | null>;
}
