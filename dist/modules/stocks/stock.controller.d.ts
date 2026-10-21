import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EnregistrerVariationStocksDto } from './dto/stock.dto';
import { StockService } from './stock.service';
export declare class StockController {
    private readonly stocks;
    constructor(stocks: StockService);
    proposer(user: AuthenticatedUser, exerciceId: string): Promise<{
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
    enregistrer(user: AuthenticatedUser, dto: EnregistrerVariationStocksDto): Promise<{
        journal: {
            type: import(".prisma/client").$Enums.TypeJournal;
            id: string;
            tenantId: string;
            createdAt: Date;
            estActif: boolean;
            intitule: string;
            code: string;
            compteTresorerieId: string | null;
            numerotation: import(".prisma/client").$Enums.NumerotationPiece;
            contrepartieChaqueLigne: boolean;
        };
        lignes: {
            id: string;
            modeReglementId: string | null;
            ecritureId: string;
            libelle: string | null;
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
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        journalId: string;
        createdBy: string;
        date: Date;
        exerciceId: string;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
        libelle: string;
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
