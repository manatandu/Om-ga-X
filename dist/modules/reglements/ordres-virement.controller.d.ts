import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OrdresVirementService } from './ordres-virement.service';
import { AnnulerOrdreDto, ListerOrdresDto } from './ordres-virement.dto';
export declare class OrdresVirementController {
    private readonly ordres;
    constructor(ordres: OrdresVirementService);
    lister(user: AuthenticatedUser, filtre: ListerOrdresDto): Promise<{
        ordres: ({
            journal: {
                intitule: string;
                code: string;
            };
            _count: {
                lignes: number;
            };
        } & {
            total: import("@prisma/client/runtime/library").Decimal;
            id: string;
            tenantId: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutOrdreVirement;
            numero: number;
            journalId: string;
            date: Date;
            donneurBanque: string;
            donneurCoordonnees: string;
            donneurBic: string | null;
            premiereImpressionLe: Date | null;
            premiereImpressionPar: string | null;
            nombreImpressions: number;
            annuleLe: Date | null;
            annulePar: string | null;
            motifAnnulation: string | null;
            creePar: string;
        })[];
        total: number;
        tronque: boolean;
        enAttenteImpression: number;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement | null;
    }>;
    detail(user: AuthenticatedUser, id: string): Promise<{
        journal: {
            intitule: string;
            code: string;
        };
        lignes: {
            montant: import("@prisma/client/runtime/library").Decimal;
            codeBic: string | null;
            banque: string;
            id: string;
            tenantId: string;
            tiersId: string | null;
            reference: string | null;
            ecritureId: string | null;
            salarieId: string | null;
            beneficiaire: string;
            ordreId: string;
            coordonnees: string;
            pieceReglement: string;
            imputationDeclaree: string | null;
        }[];
    } & {
        total: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        numero: number;
        journalId: string;
        date: Date;
        donneurBanque: string;
        donneurCoordonnees: string;
        donneurBic: string | null;
        premiereImpressionLe: Date | null;
        premiereImpressionPar: string | null;
        nombreImpressions: number;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        creePar: string;
    }>;
    avisReglement(user: AuthenticatedUser, id: string): Promise<{
        ordre: {
            id: string;
            numero: number;
            date: Date;
            statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        };
        avis: {
            ligneId: string;
            beneficiaire: string;
            montant: number;
            modele: string | null;
            texte: string;
        }[];
        lignesDeSalaires: number;
    }>;
    imprimer(user: AuthenticatedUser, id: string): Promise<{
        journal: {
            intitule: string;
            code: string;
        };
        lignes: {
            montant: import("@prisma/client/runtime/library").Decimal;
            codeBic: string | null;
            banque: string;
            id: string;
            tenantId: string;
            tiersId: string | null;
            reference: string | null;
            ecritureId: string | null;
            salarieId: string | null;
            beneficiaire: string;
            ordreId: string;
            coordonnees: string;
            pieceReglement: string;
            imputationDeclaree: string | null;
        }[];
    } & {
        total: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        numero: number;
        journalId: string;
        date: Date;
        donneurBanque: string;
        donneurCoordonnees: string;
        donneurBic: string | null;
        premiereImpressionLe: Date | null;
        premiereImpressionPar: string | null;
        nombreImpressions: number;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        creePar: string;
    }>;
    annuler(user: AuthenticatedUser, id: string, dto: AnnulerOrdreDto): Promise<{
        journal: {
            intitule: string;
            code: string;
        };
        lignes: {
            montant: import("@prisma/client/runtime/library").Decimal;
            codeBic: string | null;
            banque: string;
            id: string;
            tenantId: string;
            tiersId: string | null;
            reference: string | null;
            ecritureId: string | null;
            salarieId: string | null;
            beneficiaire: string;
            ordreId: string;
            coordonnees: string;
            pieceReglement: string;
            imputationDeclaree: string | null;
        }[];
    } & {
        total: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        numero: number;
        journalId: string;
        date: Date;
        donneurBanque: string;
        donneurCoordonnees: string;
        donneurBic: string | null;
        premiereImpressionLe: Date | null;
        premiereImpressionPar: string | null;
        nombreImpressions: number;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        creePar: string;
    }>;
}
