import { ClasseCompte, ModeReportANouveau, TypeCompteDetailTotal } from '@prisma/client';
export declare class CreerCompteDto {
    numero: string;
    intitule: string;
    classe?: ClasseCompte;
    modeReportANouveau?: ModeReportANouveau;
    typeCompte?: TypeCompteDetailTotal;
    lettrable?: boolean;
    tauxTvaDefautId?: string | null;
    codeRetraitementFiscal?: string;
}
export declare class ModifierCompteDto {
    estRetenu?: boolean;
    intitule?: string;
    codeRetraitementFiscal?: string;
    estActif?: boolean;
    modeReportANouveau?: ModeReportANouveau;
    typeCompte?: TypeCompteDetailTotal;
    bailleurId?: string | null;
    porteFondsContrepartieEtat?: boolean;
    lettrable?: boolean;
    tauxTvaDefautId?: string | null;
}
export declare class CreerCompteEnSaisieDto {
    numero: string;
    intitule: string;
}
