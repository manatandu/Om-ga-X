import { NatureCompteType } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { NaturesCompteService } from './natures-compte.service';
import { AlignerNaturesDto, ModifierNatureCompteDto } from './dto/natures-compte.dto';
export declare class NaturesCompteController {
    private readonly natures;
    constructor(natures: NaturesCompteService);
    lister(user: AuthenticatedUser): Promise<{
        natures: {
            libelle: string;
            nature: NatureCompteType;
            fourchettes: import("./natures-compte").Fourchette[];
            modeReportANouveau: import(".prisma/client").ModeReportANouveau;
            lettrable: boolean;
        }[];
        incoherences: ({
            id: string;
            numero: string;
            intitule: string;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
        } & {
            nature: NatureCompteType;
            modeAttendu: import(".prisma/client").ModeReportANouveau;
        })[];
    }>;
    modifier(user: AuthenticatedUser, nature: NatureCompteType, dto: ModifierNatureCompteDto): Promise<{
        natures: {
            libelle: string;
            nature: NatureCompteType;
            fourchettes: import("./natures-compte").Fourchette[];
            modeReportANouveau: import(".prisma/client").ModeReportANouveau;
            lettrable: boolean;
        }[];
        incoherences: ({
            id: string;
            numero: string;
            intitule: string;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
        } & {
            nature: NatureCompteType;
            modeAttendu: import(".prisma/client").ModeReportANouveau;
        })[];
    }>;
    aligner(user: AuthenticatedUser, dto: AlignerNaturesDto): Promise<{
        natures: {
            libelle: string;
            nature: NatureCompteType;
            fourchettes: import("./natures-compte").Fourchette[];
            modeReportANouveau: import(".prisma/client").ModeReportANouveau;
            lettrable: boolean;
        }[];
        incoherences: ({
            id: string;
            numero: string;
            intitule: string;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
        } & {
            nature: NatureCompteType;
            modeAttendu: import(".prisma/client").ModeReportANouveau;
        })[];
        alignes: number;
    }>;
}
