import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import { type AbsenceLue, type CongeConfronte, type JourIso } from './absences';
type Db = PrismaService | Prisma.TransactionClient;
export type AbsencesPourLesConges = {
    joursHorsService: {
        du: JourIso;
        au: JourIso;
        motif: string;
    }[];
    joursMaladie: Set<JourIso>;
};
export type LecteurAbsences = (db: Db, tenantId: string, salarieId: string) => Promise<AbsencesPourLesConges>;
export declare const AUCUNE_ABSENCE: LecteurAbsences;
export declare const PLAFOND_ABSENCES_SALARIE = 2000;
export declare function absencesDuSalarie(db: Db, tenantId: string, salarieId: string): Promise<AbsenceLue[]>;
export declare const lireAbsencesPourConges: LecteurAbsences;
export declare function congesPayesDuMois(db: Db, tenantId: string, salarieId: string, mois: string, absences?: readonly AbsenceLue[]): Promise<(CongeConfronte & {
    moisDePaie: string;
    portePar: number | null;
})[]>;
export {};
