import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OperationSpecifiqueService } from './operation-specifique.service';
import { AppliquerModeleDto, ProposerModeleDto } from './dto/operation-specifique.dto';
export declare class OperationSpecifiqueController {
    private readonly operations;
    constructor(operations: OperationSpecifiqueService);
    catalogue(user: AuthenticatedUser): Promise<{
        jeu: string;
        methodeCotisations: import(".prisma/client").$Enums.MethodeCotisations | null;
        operations: import("./operation-specifique.types").OperationSpecifique[];
        operationsAutreJeu: import("./operation-specifique.types").OperationSpecifique[];
    }>;
    proposer(user: AuthenticatedUser, dto: ProposerModeleDto): Promise<import("./operation-specifique.types").EcritureProposee>;
    appliquer(user: AuthenticatedUser, dto: AppliquerModeleDto): Promise<{
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
