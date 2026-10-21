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
    creer(tenantId: string, userId: string, dto: CreerVirementDto): Promise<{
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
    annuler(tenantId: string, userId: string, id: string, dto: AnnulerVirementDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        objet: string;
        montant: Prisma.Decimal;
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
    deposerPiece(tenantId: string, virementId: string, operation: string | undefined, fichier: {
        originalname: string;
        buffer: Buffer;
    } | undefined, email: string): Promise<{
        id: string;
        createdAt: Date;
        nomFichier: string;
        operation: import(".prisma/client").$Enums.OperationVirementFonds | null;
        taille: number;
    }>;
    telechargerPiece(tenantId: string, id: string): Promise<{
        contenu: Buffer<ArrayBufferLike>;
        nomFichier: string;
        typeMime: string;
    }>;
}
