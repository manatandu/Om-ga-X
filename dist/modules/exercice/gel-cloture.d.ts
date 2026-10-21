import { GranulariteCloture } from '@prisma/client';
export interface ClotureActive {
    granularite: GranulariteCloture;
    journalId: string | null;
    dateLimite: Date;
}
export interface LigneAGeler {
    journalId: string;
    journalCode?: string;
    date: Date;
    exerciceClos: boolean;
    journalSituation?: boolean;
}
export declare function motifLigneFigee(ligne: LigneAGeler, clotures: ClotureActive[]): string | null;
export declare function lignesFigees(prisma: unknown, tenantId: string, ligneIds: string[]): Promise<Map<string, {
    date: Date;
    motif: string;
}>>;
export declare function refuserSiLignesFigees(prisma: unknown, tenantId: string, ligneIds: string[], action: string): Promise<void>;
