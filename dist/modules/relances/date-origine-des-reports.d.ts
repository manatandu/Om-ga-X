import { Prisma } from '@prisma/client';
export declare const PROFONDEUR_MAX = 10;
export interface LigneReportee {
    id: string;
    compteId: string;
    numeroCompte: string;
    debit: number;
    credit: number;
    libelle: string | null;
    dateEcheance?: Date | null;
    date: Date;
    provisoire?: boolean;
}
export interface LigneCandidate extends LigneReportee {
    estReport: boolean;
    validee: boolean;
}
export declare function apparierAuxOrigines(reports: LigneReportee[], candidates: LigneCandidate[]): Map<string, LigneCandidate>;
type Client = Pick<Prisma.TransactionClient, 'exercice' | 'ligneEcriture'>;
export interface OrigineDuReport {
    date: Date;
    id: string;
}
export declare function datesOrigineDesReports(client: Client, tenantId: string, debutExercice: Date, reports: LigneReportee[]): Promise<Map<string, Date>>;
export declare function originesDesReports(client: Client, tenantId: string, debutExercice: Date, reports: LigneReportee[]): Promise<{
    origines: Map<string, OrigineDuReport>;
    introuvables: string[];
}>;
export {};
