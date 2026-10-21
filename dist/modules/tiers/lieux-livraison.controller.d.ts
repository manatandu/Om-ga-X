import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LieuxLivraisonService } from './lieux-livraison.service';
import { LieuLivraisonDto } from './dto/lieux-livraison.dto';
export declare class LieuxLivraisonController {
    private readonly lieux;
    constructor(lieux: LieuxLivraisonService);
    lister(user: AuthenticatedUser, tiersId: string): Promise<{
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
    creer(user: AuthenticatedUser, tiersId: string, dto: LieuLivraisonDto): Promise<{
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
    modifier(user: AuthenticatedUser, id: string, dto: LieuLivraisonDto): Promise<{
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
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
