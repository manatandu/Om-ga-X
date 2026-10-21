import { PrismaService } from '../prisma.service';
import { ObjetDesPieces, RegleDesPieces } from './table-des-pieces';
export interface PieceListee {
    id: string;
    nomFichier: string;
    typeMime: string;
    taille: number;
    empreinte: string;
    commentaire: string | null;
    deposePar: string | null;
    createdAt: Date;
}
export interface FichierRecu {
    originalname: string;
    buffer: Buffer;
}
export declare class PiecesJointesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private delegue;
    private objetDuDossier;
    lister(tenantId: string, regle: RegleDesPieces, objetId: string): Promise<{
        description: string;
        pieces: PieceListee[];
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
    deposer(tenantId: string, regle: RegleDesPieces, objetId: string, fichier: FichierRecu | undefined, commentaire: string | null | undefined, auteur: string): Promise<PieceListee>;
    private creer;
    telecharger(tenantId: string, objet: ObjetDesPieces, id: string): Promise<{
        nomFichier: string;
        typeMime: string;
        contenu: Uint8Array;
    }>;
    modifierCommentaire(tenantId: string, objet: ObjetDesPieces, id: string, commentaire: string | null | undefined): Promise<PieceListee>;
    retirer(tenantId: string, regle: RegleDesPieces, id: string): Promise<{
        retire: boolean;
    }>;
    listerDetachees(tenantId: string): Promise<{
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
    decompteParEcriture(tenantId: string, exerciceId: string): Promise<{
        parEcriture: {
            [k: string]: number;
        };
        tronque: boolean;
    }>;
}
export declare const MOTIF_PIECE_RETIREE = "Cette pi\u00E8ce a \u00E9t\u00E9 retir\u00E9e par un autre geste pendant le v\u00F4tre \u00B7 rechargez la liste.";
