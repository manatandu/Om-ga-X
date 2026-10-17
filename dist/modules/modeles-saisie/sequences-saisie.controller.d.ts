import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SequencesSaisieService } from './sequences-saisie.service';
import { CreerSequenceSaisieDto, ModifierSequenceSaisieDto } from './dto/sequence-saisie.dto';
export declare class SequencesSaisieController {
    private readonly service;
    constructor(service: SequencesSaisieService);
    lister(user: AuthenticatedUser): Promise<{
        nombreModeles: number;
        id: string;
        numero: number;
        intitule: string;
    }[]>;
    creer(user: AuthenticatedUser, dto: CreerSequenceSaisieDto): Promise<{
        id: string;
        numero: number;
        intitule: string;
    }>;
    renommer(user: AuthenticatedUser, id: string, dto: ModifierSequenceSaisieDto): Promise<{
        id: string;
        numero: number;
        intitule: string;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
