import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EnregistrerVariationStocksDto } from './dto/stock.dto';
import { type PropositionVariation } from './variation-stocks';
export declare class StockService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    proposer(tenantId: string, exerciceId: string): Promise<{
        methode: null;
        referentiel: import(".prisma/client").$Enums.Referentiel;
        reserve: string;
        proposition: null;
    } | {
        methode: "PERMANENT";
        referentiel: import(".prisma/client").$Enums.Referentiel;
        reserve: string;
        proposition: null;
    } | {
        methode: "INTERMITTENT";
        referentiel: import(".prisma/client").$Enums.Referentiel;
        reserve: null;
        proposition: {
            lignes: import("./variation-stocks").LigneProposee[];
            totaux: {
                debit: number;
                credit: number;
            };
            comptes: {
                id: string;
                numero: string;
                intitule: string;
            }[];
            retenues: import("./variation-stocks").VariationRetenue[];
            refusees: import("./variation-stocks").VariationRefusee[];
            sansMouvement: string[];
            avertissements: string[];
        };
    }>;
    private stockFinalParCompte;
    enregistrer(tenantId: string, userId: string, dto: EnregistrerVariationStocksDto): Promise<{
        journal: {
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
        };
        lignes: {
            id: string;
            libelle: string | null;
            modeReglementId: string | null;
            ecritureId: string;
            compteId: string;
            ligneReleveId: string | null;
            debit: import("@prisma/client/runtime/library").Decimal;
            credit: import("@prisma/client/runtime/library").Decimal;
            deviseId: string | null;
            dateEcheance: Date | null;
            lettre: string | null;
            lettrageId: string | null;
            aRelettrerDepuis: Date | null;
            tauxTvaId: string | null;
            rapprochementId: string | null;
            dateVersement: Date | null;
            montantDevise: import("@prisma/client/runtime/library").Decimal | null;
            coursApplique: import("@prisma/client/runtime/library").Decimal | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        journalId: string;
        createdBy: string;
        date: Date;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
        valideeAt: Date | null;
        valideeBy: string | null;
        secondRegardNom: string | null;
        secondRegardMotif: string | null;
        estGenereeParCloture: boolean;
        estSoldeDesComptesDeGestion: boolean;
        estANouveauProvisoire: boolean;
        motifImputationOuverture: import(".prisma/client").$Enums.MotifImputationOuverture | null;
        justificationImputationOuverture: string | null;
        corrigeEcritureId: string | null;
        motifCorrection: string | null;
    }>;
}
export type EtatStocks = Awaited<ReturnType<StockService['proposer']>>;
export type { PropositionVariation };
