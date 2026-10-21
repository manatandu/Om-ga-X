import { ModeReportANouveau, NatureCompteType } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { Fourchette, NatureParametree } from './natures-compte';
export declare function naturesDuDossier(prisma: unknown, tenantId: string): Promise<NatureParametree[]>;
export declare class NaturesCompteService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        natures: {
            libelle: string;
            nature: NatureCompteType;
            fourchettes: Fourchette[];
            modeReportANouveau: ModeReportANouveau;
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
            modeAttendu: ModeReportANouveau;
        })[];
    }>;
    modifier(tenantId: string, nature: NatureCompteType, dto: {
        fourchettes?: Fourchette[];
        modeReportANouveau?: ModeReportANouveau;
        lettrable?: boolean;
    }): Promise<{
        natures: {
            libelle: string;
            nature: NatureCompteType;
            fourchettes: Fourchette[];
            modeReportANouveau: ModeReportANouveau;
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
            modeAttendu: ModeReportANouveau;
        })[];
    }>;
    aligner(tenantId: string, compteIds?: string[]): Promise<{
        natures: {
            libelle: string;
            nature: NatureCompteType;
            fourchettes: Fourchette[];
            modeReportANouveau: ModeReportANouveau;
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
            modeAttendu: ModeReportANouveau;
        })[];
        alignes: number;
    }>;
    natureDuNumero(tenantId: string, numero: string): Promise<NatureParametree | null>;
}
