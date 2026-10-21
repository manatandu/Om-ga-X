import type { Response } from 'express';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { VirementsFondsService } from './virements-fonds.service';
import { AnnulerVirementDto, CreerVirementDto } from './virements-fonds.dto';
export declare class VirementsFondsController {
    private readonly virements;
    constructor(virements: VirementsFondsService);
    lister(user: AuthenticatedUser, exerciceId: string): Promise<{
        journaux: {
            caisse: boolean;
            id: string;
            intitule: string;
            code: string;
            compteTresorerie: {
                id: string;
                numero: string;
                intitule: string;
            } | null;
        }[];
        comptesDePassage: {
            sens: import(".prisma/client").$Enums.SensVirementFonds;
            libelle: string;
            compte: {
                numero: string;
                intitule: string;
            } | null;
        }[];
        virements: {
            montant: number;
            pieces: {
                id: string;
                nomFichier: string;
                operation: import(".prisma/client").$Enums.OperationVirementFonds | null;
                taille: number;
            }[];
            journalOrigine: {
                code: string;
            };
            journalDestination: {
                code: string;
            };
            ecritureOrigine: {
                statut: import(".prisma/client").$Enums.StatutEcriture;
                numeroPiece: number | null;
            } | null;
            ecritureDestination: {
                statut: import(".prisma/client").$Enums.StatutEcriture;
                numeroPiece: number | null;
            } | null;
            id: string;
            createdAt: Date;
            tenantId: string;
            objet: string;
            exerciceId: string;
            createdBy: string;
            date: Date;
            annuleLe: Date | null;
            annulePar: string | null;
            motifAnnulation: string | null;
            ecritureOrigineId: string | null;
            sens: import(".prisma/client").$Enums.SensVirementFonds;
            journalOrigineId: string;
            journalDestinationId: string;
            naturePiece: import(".prisma/client").$Enums.NaturePieceVirement;
            referencePiece: string;
            datePiece: Date;
            naturePieceEntree: import(".prisma/client").$Enums.NaturePieceVirement;
            referencePieceEntree: string;
            datePieceEntree: Date;
            porteur: string | null;
            observations: string | null;
            ecritureDestinationId: string | null;
            piecesPassees: string | null;
            ecritureNegatifOrigineId: string | null;
            ecritureNegatifDestinationId: string | null;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(user: AuthenticatedUser, dto: CreerVirementDto): Promise<{
        montant: number;
        comptePassage: {
            id: string;
            numero: string;
            intitule: string;
        };
        id: string;
        createdAt: Date;
        tenantId: string;
        objet: string;
        exerciceId: string;
        createdBy: string;
        date: Date;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        ecritureOrigineId: string | null;
        sens: import(".prisma/client").$Enums.SensVirementFonds;
        journalOrigineId: string;
        journalDestinationId: string;
        naturePiece: import(".prisma/client").$Enums.NaturePieceVirement;
        referencePiece: string;
        datePiece: Date;
        naturePieceEntree: import(".prisma/client").$Enums.NaturePieceVirement;
        referencePieceEntree: string;
        datePieceEntree: Date;
        porteur: string | null;
        observations: string | null;
        ecritureDestinationId: string | null;
        piecesPassees: string | null;
        ecritureNegatifOrigineId: string | null;
        ecritureNegatifDestinationId: string | null;
    }>;
    annuler(user: AuthenticatedUser, id: string, dto: AnnulerVirementDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        objet: string;
        montant: import("@prisma/client/runtime/library").Decimal;
        exerciceId: string;
        createdBy: string;
        date: Date;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        ecritureOrigineId: string | null;
        sens: import(".prisma/client").$Enums.SensVirementFonds;
        journalOrigineId: string;
        journalDestinationId: string;
        naturePiece: import(".prisma/client").$Enums.NaturePieceVirement;
        referencePiece: string;
        datePiece: Date;
        naturePieceEntree: import(".prisma/client").$Enums.NaturePieceVirement;
        referencePieceEntree: string;
        datePieceEntree: Date;
        porteur: string | null;
        observations: string | null;
        ecritureDestinationId: string | null;
        piecesPassees: string | null;
        ecritureNegatifOrigineId: string | null;
        ecritureNegatifDestinationId: string | null;
    }>;
    deposerPiece(user: AuthenticatedUser, id: string, operation: string | undefined, fichier: {
        originalname: string;
        buffer: Buffer;
    } | undefined): Promise<{
        id: string;
        createdAt: Date;
        nomFichier: string;
        operation: import(".prisma/client").$Enums.OperationVirementFonds | null;
        taille: number;
    }>;
    telechargerPiece(user: AuthenticatedUser, id: string, res: Response): Promise<void>;
}
