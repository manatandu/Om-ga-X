import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EcritureProposee, OperationSpecifique } from './operation-specifique.types';
import { AppliquerModeleDto, ProposerModeleDto } from './dto/operation-specifique.dto';
export declare const CATALOGUE: OperationSpecifique[];
export declare class OperationSpecifiqueService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    catalogue(tenantId: string): Promise<{
        jeu: string;
        methodeCotisations: import(".prisma/client").$Enums.MethodeCotisations | null;
        operations: OperationSpecifique[];
        operationsAutreJeu: OperationSpecifique[];
    }>;
    private trouverModele;
    private verifierDroitDAgir;
    private montantDeLaLigne;
    private resoudreComptes;
    proposer(tenantId: string, dto: ProposerModeleDto): Promise<EcritureProposee>;
    appliquer(tenantId: string, userId: string, dto: AppliquerModeleDto): Promise<{
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
