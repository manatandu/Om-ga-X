import { ClasseCompte, ModeReportANouveau, TypeCompteDetailTotal } from '@prisma/client';
type LigneSeed = {
    numero: string;
    intitule: string;
    classe: ClasseCompte;
    modeReportANouveau: ModeReportANouveau;
    typeCompte?: TypeCompteDetailTotal;
};
export declare const PLAN_COMPTES_SYSCOHADA: LigneSeed[];
export {};
