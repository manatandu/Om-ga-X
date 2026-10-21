import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RibsTiersService } from './ribs-tiers.service';
import { RibTiersDto } from './dto/ribs-tiers.dto';
export declare class RibsTiersController {
    private readonly ribs;
    constructor(ribs: RibsTiersService);
    lister(user: AuthenticatedUser, tiersId: string): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        tiersId: string;
        estPrincipal: boolean;
    }[]>;
    creer(user: AuthenticatedUser, tiersId: string, dto: RibTiersDto): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        tiersId: string;
        estPrincipal: boolean;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: RibTiersDto): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        tiersId: string;
        estPrincipal: boolean;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
