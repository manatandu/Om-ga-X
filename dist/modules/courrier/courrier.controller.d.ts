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
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutMessage;
            sujet: string;
            origine: string;
            createdBy: string | null;
            destinataire: string;
            destinataireNom: string | null;
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
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutMessage;
        tenantId: string;
        corps: string;
        sujet: string;
        origine: string;
        createdBy: string | null;
        destinataire: string;
        destinataireNom: string | null;
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
