import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ModesReglementService } from './modes-reglement.service';
import { CreerModeReglementDto, ModifierModeReglementDto } from './modes-reglement.dto';
export declare class ModesReglementController {
    private readonly modes;
    constructor(modes: ModesReglementService);
    lister(user: AuthenticatedUser): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeReglement;
        journal: {
            intitule: string;
            code: string;
        } | null;
        id: string;
        estActif: boolean;
        intitule: string;
        code: string;
        journalId: string | null;
        codeInterbancaire: string | null;
    }[]>;
    creer(user: AuthenticatedUser, dto: CreerModeReglementDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeReglement;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        journalId: string | null;
        createdBy: string;
        codeInterbancaire: string | null;
    }>;
    creerUsuels(user: AuthenticatedUser): Promise<{
        crees: string[];
        dejaPresents: string[];
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierModeReglementDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeReglement;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        journalId: string | null;
        createdBy: string;
        codeInterbancaire: string | null;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
