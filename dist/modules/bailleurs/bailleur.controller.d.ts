import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BailleurService } from './bailleur.service';
import { CreerBailleurDto, ModifierBailleurDto } from './dto/bailleur.dto';
export declare class BailleurController {
    private readonly bailleurService;
    constructor(bailleurService: BailleurService);
    lister(user: AuthenticatedUser, actifsSeuls?: string): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        code: string;
    }[]>;
    creer(user: AuthenticatedUser, dto: CreerBailleurDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        code: string;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierBailleurDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        code: string;
    }>;
}
