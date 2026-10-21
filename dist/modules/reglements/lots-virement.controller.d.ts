import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LotsVirementService } from './lots-virement.service';
import { LotVirementDto } from './lots-virement.dto';
export declare class LotsVirementController {
    private readonly lots;
    constructor(lots: LotsVirementService);
    lister(user: AuthenticatedUser): Promise<{
        id: string;
        nom: string;
        journalId: string | null;
        lignes: {
            compteId: string;
            numero: string;
            intitule: string;
            montant: number;
        }[];
    }[]>;
    creer(user: AuthenticatedUser, dto: LotVirementDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        journalId: string | null;
        creePar: string;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: LotVirementDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        journalId: string | null;
        creePar: string;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
