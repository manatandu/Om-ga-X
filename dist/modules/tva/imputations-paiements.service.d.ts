import { PrismaService } from '../../common/prisma.service';
import { DeclarerImputationDto, RetirerImputationDto } from './dto/imputation-paiement.dto';
import { TauxTvaService } from './taux-tva.service';
export declare const PLAFOND_LIGNES_GROUPE_IMPUTATION = 500;
export type EffetSurLiquidation = {
    du: string;
    au: string;
    premierJourLibre: string;
    collecte: number | null;
    deductible: number | null;
    message: string;
};
export declare class ImputationsPaiementsService {
    private readonly prisma;
    private readonly tva;
    private readonly journalServeur;
    constructor(prisma: PrismaService, tva: TauxTvaService);
    private lignesDeTiers;
    private lignesDuGroupe;
    private lireLeGroupe;
    private dejaRecuParFacture;
    private verrouiller;
    private periodeLiquidee;
    private taxeDuJour;
    private avecEffetSurLiquidation;
    declarer(tenantId: string, userId: string, dto: DeclarerImputationDto): Promise<{
        imputations: {
            montant: number;
            id: string;
            tenantId: string;
            createdAt: Date;
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
        liquidation: EffetSurLiquidation | null;
    }>;
    retirer(tenantId: string, userId: string, ligneReglementId: string, dto: RetirerImputationDto): Promise<{
        retirees: number;
        liquidation: EffetSurLiquidation | null;
    }>;
    groupe(tenantId: string, ligneId: string): Promise<{
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
}
