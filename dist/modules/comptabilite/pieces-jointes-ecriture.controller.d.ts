import type { Response } from 'express';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PiecesJointesService, type FichierRecu } from '../../common/pieces-jointes/pieces-jointes.service';
import { CommentairePieceJointeDto, DeposerPieceJointeDto } from '../../common/pieces-jointes/pieces-jointes.dto';
export declare class PiecesJointesEcritureController {
    private readonly pieces;
    constructor(pieces: PiecesJointesService);
    lister(user: AuthenticatedUser, ecritureId: string): Promise<{
        description: string;
        pieces: import("../../common/pieces-jointes/pieces-jointes.service").PieceListee[];
        total: number;
        tronque: boolean;
        depot: {
            permis: boolean;
            motif: string | null;
        };
        retrait: {
            permis: boolean;
            motif: string | null;
        };
    }>;
    deposer(user: AuthenticatedUser, ecritureId: string, fichier: FichierRecu | undefined, dto: DeposerPieceJointeDto): Promise<import("../../common/pieces-jointes/pieces-jointes.service").PieceListee>;
    detachees(user: AuthenticatedUser): Promise<{
        pieces: {
            nomFichier: string;
            commentaire: string | null;
            empreinte: string;
            id: string;
            createdAt: Date;
            typeMime: string;
            taille: number;
            deposePar: string | null;
            ecritureDecrite: string;
        }[];
        total: number;
        tronque: boolean;
    }>;
    decompte(user: AuthenticatedUser, exerciceId: string): Promise<{
        parEcriture: {
            [k: string]: number;
        };
        tronque: boolean;
    }>;
    telecharger(user: AuthenticatedUser, id: string, res: Response): Promise<void>;
    commenter(user: AuthenticatedUser, id: string, dto: CommentairePieceJointeDto): Promise<import("../../common/pieces-jointes/pieces-jointes.service").PieceListee>;
    retirer(user: AuthenticatedUser, id: string): Promise<{
        retire: boolean;
    }>;
}
