import { PrismaService } from '../../common/prisma.service';
export declare class DocumentsTiersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private tiersDuDossier;
    lister(tenantId: string, tiersId: string): Promise<{
        id: string;
        createdAt: Date;
        nomFichier: string;
        commentaire: string | null;
        empreinte: string;
        tiersId: string;
        typeMime: string;
        taille: number;
        deposePar: string | null;
    }[]>;
    deposer(tenantId: string, tiersId: string, fichier: {
        originalname: string;
        buffer: Buffer;
    } | undefined, commentaire: string | undefined, auteur: string): Promise<{
        id: string;
        createdAt: Date;
        nomFichier: string;
        commentaire: string | null;
        empreinte: string;
        tiersId: string;
        typeMime: string;
        taille: number;
        deposePar: string | null;
    }>;
    modifierCommentaire(tenantId: string, id: string, commentaire: string | null | undefined): Promise<{
        id: string;
        createdAt: Date;
        nomFichier: string;
        commentaire: string | null;
        empreinte: string;
        tiersId: string;
        typeMime: string;
        taille: number;
        deposePar: string | null;
    }>;
    private trouver;
    telecharger(tenantId: string, id: string): Promise<{
        contenu: Buffer<ArrayBufferLike>;
        nomFichier: string;
        typeMime: string;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
