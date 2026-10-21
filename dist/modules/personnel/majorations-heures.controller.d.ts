import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MajorationsHeuresService } from './majorations-heures.service';
import { MajorationHeuresDto } from './dto/majorations.dto';
export declare class MajorationsHeuresController {
    private readonly majorations;
    constructor(majorations: MajorationsHeuresService);
    lister(user: AuthenticatedUser): Promise<{
        natures: {
            libelle: string;
            fondement: string;
            heureEntiere: boolean;
            cle: string;
        }[];
        majorations: {
            id: string;
            nature: import(".prisma/client").$Enums.NatureMajorationHeures;
            libelle: string;
            tauxPourCent: number;
            source: string;
            dateEffet: string;
            actif: boolean;
            desactiveLe: Date | null;
            creePar: string;
        }[];
        tronque: boolean;
    }>;
    creer(user: AuthenticatedUser, dto: MajorationHeuresDto): Promise<{
        id: string;
    }>;
    desactiver(user: AuthenticatedUser, id: string): Promise<{
        desactive: boolean;
    }>;
}
