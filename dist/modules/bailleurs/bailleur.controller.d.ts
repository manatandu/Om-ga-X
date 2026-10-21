import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BailleurService } from './bailleur.service';
import { CreerBailleurDto, ModifierBailleurDto } from './dto/bailleur.dto';
export declare class BailleurController {
    private readonly bailleurService;
    constructor(bailleurService: BailleurService);
    lister(user: AuthenticatedUser, actifsSeuls?: string): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        code: string;
    }[]>;
    creer(user: AuthenticatedUser, dto: CreerBailleurDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        code: string;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierBailleurDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        code: string;
    }>;
}
