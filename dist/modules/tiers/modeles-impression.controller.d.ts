import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ModelesImpressionService } from './modeles-impression.service';
import { CreerModeleImpressionDto, ModifierModeleImpressionDto } from './dto/modeles-impression.dto';
export declare class ModelesImpressionController {
    private readonly modeles;
    constructor(modeles: ModelesImpressionService);
    lister(user: AuthenticatedUser): Promise<{
        nombreTiers: number;
        id: string;
        nature: import(".prisma/client").$Enums.NatureModeleImpression;
        intitule: string;
        texte: string;
    }[]>;
    creer(user: AuthenticatedUser, dto: CreerModeleImpressionDto): Promise<{
        id: string;
        nature: import(".prisma/client").$Enums.NatureModeleImpression;
        intitule: string;
        texte: string;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierModeleImpressionDto): Promise<{
        id: string;
        nature: import(".prisma/client").$Enums.NatureModeleImpression;
        intitule: string;
        texte: string;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
