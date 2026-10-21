import { type Prisma } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import { type AbsenceLue, type JourIso } from './absences';
type Db = PrismaService | Prisma.TransactionClient;
export type ContratDuSalaire = {
    readonly remunerationBase: Prisma.Decimal | number | null;
    readonly periodiciteRemuneration: string | null;
    readonly deviseRemuneration: string | null;
};
export type CongeAConfronter = {
    readonly id?: string;
    readonly du: JourIso;
    readonly au: JourIso;
    readonly joursVoyage: number;
    readonly remunerationJournaliere: number | null;
    readonly deviseAllocation: string | null;
};
export type Confrontation = {
    readonly refus: string | null;
    readonly avertissement: string | null;
};
export declare function salaireDeLaSaisie(entree: unknown): {
    salaire: number;
    devise: 'CDF' | 'USD';
} | null;
export declare function moisTouches(du: JourIso, au: JourIso): string[];
export declare function confronterSalaireAuxConges(db: Db, tenantId: string, salarieId: string, p: {
    readonly mois: string;
    readonly salaire: number;
    readonly devise: string;
    readonly contrat: ContratDuSalaire | null;
    readonly candidat?: CongeAConfronter;
    readonly bulletinEmis?: {
        readonly numero: number;
        readonly issue: string;
    };
    readonly absences?: readonly AbsenceLue[];
}): Promise<Confrontation>;
export declare function confronterLesBulletinsEmis(db: Db, tenantId: string, salarieId: string, conge: CongeAConfronter, p: {
    readonly saufMois?: string;
    readonly issue: (numero: number, mois: string) => string;
}): Promise<{
    refus: string[];
    avertissements: string[];
}>;
export declare function bulletinsQuiRetranchentLeConge(db: Db, tenantId: string, salarieId: string, conge: {
    readonly id: string;
    readonly du: JourIso;
    readonly au: JourIso;
    readonly joursVoyage: number;
}): Promise<{
    refus: string[];
    avertissements: string[];
}>;
export {};
