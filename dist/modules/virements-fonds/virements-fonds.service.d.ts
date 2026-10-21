import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import type { AnnulerVirementDto, CreerVirementDto } from './virements-fonds.dto';
export declare class VirementsFondsService {
    private readonly prisma;
    private readonly ecritures;
    private readonly exercices;
    constructor(prisma: PrismaService, ecritures: EcritureService, exercices: ExerciceService);
    private journaux;
    lister(tenantId: string, exerciceId: string): Promise<{
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
                nomFichier: string;
                id: string;
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
            objet: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            createdBy: string;
            date: Date;
            annuleLe: Date | null;
            annulePar: string | null;
            motifAnnulation: string | null;
            exerciceId: string;
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
    creer(tenantId: string, userId: string, dto: CreerVirementDto): Promise<{
        montant: number;
        comptePassage: {
            id: string;
            numero: string;
            intitule: string;
        };
        objet: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        exerciceId: string;
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
    annuler(tenantId: string, userId: string, id: string, dto: AnnulerVirementDto): Promise<{
        objet: string;
        montant: Prisma.Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        exerciceId: string;
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
    deposerPiece(tenantId: string, virementId: string, operation: string | undefined, fichier: {
        originalname: string;
        buffer: Buffer;
    } | undefined, email: string): Promise<{
        nomFichier: string;
        id: string;
        operation: import(".prisma/client").$Enums.OperationVirementFonds | null;
        createdAt: Date;
        taille: number;
    }>;
    telechargerPiece(tenantId: string, id: string): Promise<{
        contenu: Buffer<ArrayBufferLike>;
        nomFichier: string;
        typeMime: string;
    }>;
}
