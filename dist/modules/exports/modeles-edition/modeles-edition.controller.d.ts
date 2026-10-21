import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ModelesEditionService } from './modeles-edition.service';
import { CreerModeleEditionDto, RemplacerModeleEditionDto } from './dto/modele-edition.dto';
export declare class ModelesEditionController {
    private readonly service;
    constructor(service: ModelesEditionService);
    lister(user: AuthenticatedUser, edition?: string): Promise<{
        modeles: {
            id: string;
            nom: string;
            edition: import(".prisma/client").$Enums.EditionModele;
            creeLe: Date;
            modifieLe: Date;
            colonnes: string[];
            saut: import(".prisma/client").$Enums.SautEdition;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(user: AuthenticatedUser, dto: CreerModeleEditionDto): Promise<{
        id: string;
        nom: string;
        edition: import(".prisma/client").$Enums.EditionModele;
        creeLe: Date;
        modifieLe: Date;
        colonnes: string[];
        saut: import(".prisma/client").$Enums.SautEdition;
    }>;
    remplacer(user: AuthenticatedUser, id: string, dto: RemplacerModeleEditionDto): Promise<{
        id: string;
        nom: string;
        edition: import(".prisma/client").$Enums.EditionModele;
        creeLe: Date;
        modifieLe: Date;
        colonnes: string[];
        saut: import(".prisma/client").$Enums.SautEdition;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
