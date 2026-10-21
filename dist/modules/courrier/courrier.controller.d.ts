import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CourrierService } from './courrier.service';
import { ListerFileDto, ReprendreDto } from './dto/courrier.dto';
export declare class CourrierController {
    private readonly courrier;
    constructor(courrier: CourrierService);
    etatDuTransport(): import("./transport-courriel").EtatTransport;
    compteurs(user: AuthenticatedUser): Promise<import("./courrier.service").CompteursParStatut>;
    lister(user: AuthenticatedUser, dto: ListerFileDto): Promise<{
        messages: {
            origine: string;
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutMessage;
            createdBy: string | null;
            destinataire: string;
            destinataireNom: string | null;
            sujet: string;
            origineId: string | null;
            tentatives: number;
            dernierEssaiAt: Date | null;
            prochainEssaiAt: Date | null;
            erreur: string | null;
            envoyeAt: Date | null;
        }[];
        total: number;
        plafond: number;
        tronque: boolean;
    }>;
    reprendre(user: AuthenticatedUser, dto: ReprendreDto): Promise<import("./courrier.service").BilanReprise>;
    lire(user: AuthenticatedUser, id: string): Promise<{
        origine: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutMessage;
        createdBy: string | null;
        destinataire: string;
        destinataireNom: string | null;
        sujet: string;
        corps: string;
        origineId: string | null;
        pieceJointeNom: string | null;
        pieceJointeTexte: string | null;
        tentatives: number;
        dernierEssaiAt: Date | null;
        prochainEssaiAt: Date | null;
        erreur: string | null;
        envoyeAt: Date | null;
    }>;
}
