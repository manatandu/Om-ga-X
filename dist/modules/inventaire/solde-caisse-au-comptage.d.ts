import { ModeComparaisonCaisse, Prisma } from '@prisma/client';
type Client = Prisma.TransactionClient;
export interface ExerciceBorne {
    id: string;
    dateDebut: Date;
    dateFin: Date;
}
export interface UniteComparaison {
    mode: ModeComparaisonCaisse;
    devise: {
        id: string;
        code: string;
    } | null;
}
export interface ReconstitutionCaisse {
    dateCloture: Date;
    soldeALaCloture: number;
    mouvementsValeurAvantCloture: number;
    encaissementsPosterieurs: number;
    decaissementsPosterieurs: number;
    mouvementsPosterieurs: number;
}
export type LectureSoldeCaisse = {
    lisible: true;
    soldeComptable: number;
    unite: UniteComparaison;
    reconstitution: ReconstitutionCaisse | null;
} | {
    lisible: false;
    motif: string;
};
export declare const FORMAT_DATE_COMPTAGE: RegExp;
export declare function compteApresLaCloture(dateComptage: Date, dateFin: Date): boolean;
export declare function auPlusTardLe(jourJ: Date): Prisma.EcritureWhereInput;
export declare function filtreExercicesSuivants(tenantId: string, dateFin: Date, dateComptage: Date): Prisma.ExerciceWhereInput;
export declare function exercicesDuComptage(dateFin: Date, dateComptage: Date, suivants: ExerciceBorne[]): {
    ids: string[];
} | {
    motif: string;
};
export declare function especesReconstitueesALaCloture(especesComptees: number, r: Pick<ReconstitutionCaisse, 'encaissementsPosterieurs' | 'decaissementsPosterieurs'>): number;
export declare function valeurAPorterSurLaFiche(pv: {
    numero: string;
    dateComptage: Date;
    especesComptees: number;
    soldeALaCloture: number | null;
    encaissementsPosterieurs: number | null;
    decaissementsPosterieurs: number | null;
    unite: string | null;
}, dateCloture: Date | null): string;
export interface Fenetres {
    exercice: Prisma.EcritureWhereInput;
    suivants: Prisma.EcritureWhereInput | null;
    intercales: Prisma.EcritureWhereInput | null;
    valeurAvantCloture: Prisma.EcritureWhereInput | null;
}
export declare function fenetresDuComptage(tenantId: string, exercice: ExerciceBorne, dateComptage: Date, idsSuivants: string[] | null): Fenetres;
export declare function uniteDeLaCaisse(prisma: Client, compteId: string, fenetres: Ecr[]): Promise<UniteComparaison>;
type Ecr = Prisma.EcritureWhereInput;
export declare function sommesDansLUnite(prisma: Client, compteId: string, ecriture: Ecr, unite: UniteComparaison): Promise<{
    debit: number;
    credit: number;
    nombre: number;
}>;
export declare function lireSoldeCaisseAuComptage(prisma: Client, tenantId: string, compteId: string, exercice: ExerciceBorne, dateComptage: Date, maintenant?: Date): Promise<LectureSoldeCaisse>;
export declare function luesParLePv(e: Ecr, etabliLe: Date): Ecr;
export declare function valideesDepuisLePv(e: Ecr, etabliLe: Date): Ecr;
export declare function mentionsDuPv(pv: {
    dateComptage: Date;
    dateCloture: Date;
    mode: ModeComparaisonCaisse;
    soldeComptable: number;
    soldeALaCloture: number | null;
    mouvementsValeurAvantCloture: number | null;
    especesReconstituees: number | null;
}): string[];
export {};
