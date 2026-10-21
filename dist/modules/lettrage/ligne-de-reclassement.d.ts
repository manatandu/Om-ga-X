import type { Prisma } from '@prisma/client';
export declare const MOTIF_LETTRAGE_RECLASSEMENT: string;
interface LecteurLignes {
    ligneEcriture: {
        findMany: (args: Prisma.LigneEcritureFindManyArgs) => Promise<unknown[]>;
    };
}
export declare function lignesDuCompteClientReclasse(db: LecteurLignes, tenantId: string, ligneIds: readonly string[]): Promise<Set<string>>;
export declare function lignesReclasseesDuCompte(db: LecteurLignes, tenantId: string, compteId: string): Promise<Set<string>>;
export declare function reportsDuReclassementParIdentifiants(db: LecteurLignes, tenantId: string, ligneIds: readonly string[]): Promise<Set<string>>;
export declare const MOTIF_LETTRAGE_PERTE_AVEC_TVA: string;
export declare function lignesDeLaPerteAvecTva(db: LecteurLignes, tenantId: string, ligneIds: readonly string[]): Promise<Set<string>>;
export declare function refuserLignesDuCompteClientReclasse(db: LecteurLignes, tenantId: string, ligneIds: readonly string[], dejaDuGroupe?: readonly string[]): Promise<void>;
export interface LigneAMettreDeCote {
    id: string;
}
export declare function lignesMisesDeCote(lignes: readonly LigneAMettreDeCote[], reclassees: ReadonlySet<string>): {
    ecartees: Set<string>;
    passesParMontantSuspendues: boolean;
};
export declare function messageMiseDeCote(nombre: number, suspendues: boolean): string | null;
export {};
