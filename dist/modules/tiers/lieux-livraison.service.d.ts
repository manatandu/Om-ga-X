import { PrismaService } from '../../common/prisma.service';
import { LieuLivraisonDto } from './dto/lieux-livraison.dto';
export declare class LieuxLivraisonService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private clientDuDossier;
    private trouver;
    private verrouillerLeClient;
    private jugerLeGeste;
    lister(tenantId: string, tiersId: string): Promise<{
        lieux: {
            id: string;
            createdAt: Date;
            adresse: string | null;
            ville: string | null;
            pays: string | null;
            telephone: string | null;
            email: string | null;
            estActif: boolean;
            tenantId: string;
            intitule: string;
            contact: string | null;
            boitePostale: string | null;
            tiersId: string;
            estPrincipal: boolean;
            complement: string | null;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(tenantId: string, tiersId: string, dto: LieuLivraisonDto): Promise<{
        id: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        email: string | null;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        contact: string | null;
        boitePostale: string | null;
        tiersId: string;
        estPrincipal: boolean;
        complement: string | null;
    }>;
    modifier(tenantId: string, id: string, dto: LieuLivraisonDto): Promise<{
        id: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        email: string | null;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        contact: string | null;
        boitePostale: string | null;
        tiersId: string;
        estPrincipal: boolean;
        complement: string | null;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
