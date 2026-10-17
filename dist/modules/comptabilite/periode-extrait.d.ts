import type { Prisma } from '@prisma/client';
export interface PeriodeExtrait {
    du: Date;
    au: Date;
    finExclue: Date;
    finExercice: Date;
}
export interface ReportALaVeille {
    au: Date;
    debit: number;
    credit: number;
}
export declare function jourFr(d: Date): string;
export declare function veilleDe(d: Date): Date;
export declare function libellePeriode(p: Pick<PeriodeExtrait, 'du' | 'au'>): string;
export declare function motifPeriodeHorsExercice(exercice: {
    dateDebut: Date;
    dateFin: Date;
}): string;
export declare function periodeDeLExtrait(exercice: {
    dateDebut: Date;
    dateFin: Date;
}, demande: {
    du?: string | null;
    au?: string | null;
}): PeriodeExtrait | null;
export declare function ecrituresAvantLaPeriode(p: Pick<PeriodeExtrait, 'du' | 'finExercice'>): Prisma.EcritureWhereInput;
export declare function ecrituresDansLaPeriode(p: PeriodeExtrait): Prisma.EcritureWhereInput;
export declare function periodeServie(p: PeriodeExtrait | null): {
    du: string;
    au: string;
} | null;
