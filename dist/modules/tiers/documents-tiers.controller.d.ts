import type { Response } from 'express';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DocumentsTiersService } from './documents-tiers.service';
import { CommentaireDocumentDto, DeposerDocumentDto } from './dto/documents-tiers.dto';
export { REFUS_MULTER, RefusEnvoi } from '../../common/pieces-jointes/refus-envoi.filter';
export declare class DocumentsTiersController {
    private readonly documents;
    constructor(documents: DocumentsTiersService);
    lister(user: AuthenticatedUser, tiersId: string): Promise<{
        nomFichier: string;
        commentaire: string | null;
        empreinte: string;
        id: string;
        createdAt: Date;
        tiersId: string;
        typeMime: string;
        taille: number;
        deposePar: string | null;
    }[]>;
    deposer(user: AuthenticatedUser, tiersId: string, fichier: {
        originalname: string;
        buffer: Buffer;
    } | undefined, dto: DeposerDocumentDto): Promise<{
        nomFichier: string;
        commentaire: string | null;
        empreinte: string;
        id: string;
        createdAt: Date;
        tiersId: string;
        typeMime: string;
        taille: number;
        deposePar: string | null;
    }>;
    telecharger(user: AuthenticatedUser, id: string, res: Response): Promise<void>;
    modifier(user: AuthenticatedUser, id: string, dto: CommentaireDocumentDto): Promise<{
        nomFichier: string;
        commentaire: string | null;
        empreinte: string;
        id: string;
        createdAt: Date;
        tiersId: string;
        typeMime: string;
        taille: number;
        deposePar: string | null;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
