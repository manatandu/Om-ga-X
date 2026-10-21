import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ImputationsPaiementsService } from './imputations-paiements.service';
import { DeclarerImputationDto, RetirerImputationDto } from './dto/imputation-paiement.dto';
export declare class ImputationsPaiementsController {
    private readonly imputations;
    constructor(imputations: ImputationsPaiementsService);
    groupe(user: AuthenticatedUser, ligneId: string): Promise<{
        nonServi: string;
        lettrageId: string | null;
        compte: {
            numero: string;
            intitule: string;
        };
        factures: never[];
        paiements: never[];
        nonImpute: never[];
        tronque: boolean;
        declareesTronquees: boolean;
    } | {
        lettrageId: string;
        compte: {
            numero: string;
            intitule: string;
        };
        tronque: boolean;
        declareesTronquees: boolean;
        factures: {
            id: string;
            ligneADesigner: string | null;
            reportee: boolean;
            libelle: string;
            piece: number | null;
            date: string | null;
            echeance: string | null;
            montant: number;
            imputations: {
                paiementId: string;
                date: string | null;
                montant: number;
                fondement: import("./imputation-paiements").FondementImputation;
            }[];
        }[];
        paiements: {
            libelle: string;
            piece: number | null;
            date: string | null;
            montant: number;
            validee: boolean;
            declarees: {
                montant: number;
                pieceDate: string | null;
                id: string;
                ligneReglementId: string;
                ligneFactureId: string;
                fondement: import(".prisma/client").$Enums.FondementImputationPaiement;
                pieceReference: string;
                preuveAcceptation: string | null;
            }[];
            motifNonDesignable?: string | undefined;
            id: string;
            designable: boolean;
        }[];
        nonImpute: {
            paiementId: string;
            montant: number;
        }[];
    }>;
    declarer(user: AuthenticatedUser, dto: DeclarerImputationDto): Promise<{
        imputations: {
            montant: number;
            id: string;
            createdAt: Date;
            tenantId: string;
            createdBy: string;
            retireeLe: Date | null;
            retireePar: string | null;
            motifRetrait: string | null;
            ligneReglementId: string;
            ligneFactureId: string;
            fondement: import(".prisma/client").$Enums.FondementImputationPaiement;
            pieceReference: string;
            pieceDate: Date;
            preuveAcceptation: string | null;
        }[];
        liquidation: import("./imputations-paiements.service").EffetSurLiquidation | null;
    }>;
    retirer(user: AuthenticatedUser, ligneReglementId: string, dto: RetirerImputationDto): Promise<{
        retirees: number;
        liquidation: import("./imputations-paiements.service").EffetSurLiquidation | null;
    }>;
}
