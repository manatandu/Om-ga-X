import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ConditionsLicenceService } from './conditions-licence.service';
import { AccepterConditionsDto } from './dto/conditions-licence.dto';
export declare class ConditionsLicenceController {
    private readonly conditions;
    constructor(conditions: ConditionsLicenceService);
    etat(user: AuthenticatedUser): Promise<import("./acceptation-conditions").EtatConditions>;
    accepter(user: AuthenticatedUser, dto: AccepterConditionsDto): Promise<{
        etat: import("./acceptation-conditions").EtatConditions;
        deja: boolean;
        accuse: {
            statut: import("./acceptation-conditions").StatutAccuse;
        } | null;
    }>;
    renvoyerAccuse(user: AuthenticatedUser): Promise<{
        etat: import("./acceptation-conditions").EtatConditions;
        accuse: {
            statut: import("./acceptation-conditions").StatutAccuse;
        } | null;
    }>;
}
