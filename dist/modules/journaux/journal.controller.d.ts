import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JournalService } from './journal.service';
import { AnalyseJournauxService } from './analyse-journaux.service';
import { CompteDuJournalProposeDto, CreerJournalDto, ModifierJournalDto } from './dto/journal.dto';
export declare class JournalController {
    private readonly journalService;
    private readonly analyseJournauxService;
    constructor(journalService: JournalService, analyseJournauxService: AnalyseJournauxService);
    lister(user: AuthenticatedUser, actifsSeuls?: string): Promise<({
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
            partVariableGestionPct: import("@prisma/client/runtime/library").Decimal | null;
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
    palmaresComptes(user: AuthenticatedUser, exerciceId: string, classe?: string, limite?: string, inclureBrouillard?: string): Promise<{
        lignes: import("./analyse-journaux.service").LignePalmares[];
        total: {
            mouvement: number;
            comptes: number;
        };
        tronque: boolean;
    }>;
    grilleSaisie(user: AuthenticatedUser, exerciceId: string): Promise<{
        mois: string[];
        journaux: {
            cases: import("./etat-journaux-saisie").CaseJournalMois[];
            id: string;
            type: import(".prisma/client").$Enums.TypeJournal;
            estActif: boolean;
            intitule: string;
            code: string;
        }[];
    }>;
    analyse(user: AuthenticatedUser, exerciceId: string): Promise<{
        lignes: import("./analyse-journaux.service").LigneAnalyseJournal[];
        sequenceDuDossier: {
            applicable: boolean;
            explication: string;
            manquants: number;
            trous: Array<{
                de: number;
                a: number;
            }>;
            rattachesALArret?: {
                nombre: number;
                explication: string;
            };
        };
    }>;
    comptesDuPlan(user: AuthenticatedUser): Promise<{
        id: string;
        numero: string;
        intitule: string;
    }[]>;
    compteDuJournalPropose(user: AuthenticatedUser, dto: CompteDuJournalProposeDto): Promise<{
        numero: string | null;
        racine: string;
        longueur: number;
        compteDuPlan: {
            numero: string;
            intitule: string;
        };
        motif: string | null;
    }>;
    creer(user: AuthenticatedUser, dto: CreerJournalDto): Promise<{
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
    modifier(user: AuthenticatedUser, id: string, dto: ModifierJournalDto): Promise<{
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
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
