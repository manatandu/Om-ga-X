import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SelectionsEditionService } from './selections-edition.service';
import { CreerSelectionEditionDto, RemplacerSelectionEditionDto } from './dto/selection-edition.dto';
export declare class SelectionsEditionController {
    private readonly service;
    constructor(service: SelectionsEditionService);
    lister(user: AuthenticatedUser, edition?: string): Promise<{
        selections: {
            creePar: string;
            journalIntrouvable: boolean;
            id: string;
            nom: string;
            criteres: import("@prisma/client/runtime/library").JsonValue;
            edition: import(".prisma/client").$Enums.EditionSelection;
            creeLe: Date;
            modifieLe: Date;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(user: AuthenticatedUser, dto: CreerSelectionEditionDto): Promise<{
        id: string;
        nom: string;
        criteres: import("@prisma/client/runtime/library").JsonValue;
        edition: import(".prisma/client").$Enums.EditionSelection;
    }>;
    remplacer(user: AuthenticatedUser, id: string, dto: RemplacerSelectionEditionDto): Promise<{
        id: string;
        nom: string;
        criteres: import("@prisma/client/runtime/library").JsonValue;
        edition: import(".prisma/client").$Enums.EditionSelection;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprimee: boolean;
    }>;
}
