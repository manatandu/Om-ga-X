import { ModeReportANouveau } from '@prisma/client';
export declare class ModifierNatureCompteDto {
    fourchettes?: {
        du: string;
        au: string;
    }[];
    modeReportANouveau?: ModeReportANouveau;
    lettrable?: boolean;
}
export declare class AlignerNaturesDto {
    compteIds?: string[];
}
