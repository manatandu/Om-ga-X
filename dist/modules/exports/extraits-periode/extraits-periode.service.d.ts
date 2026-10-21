import { NatureExtraitPeriode } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { type PeriodeExtrait } from '../../comptabilite/periode-extrait';
export interface ExtraitNumerote {
    numero: number;
    etabliLe: Date;
    periode: PeriodeExtrait;
}
export interface DemandeExtrait {
    tenantId: string;
    nature: NatureExtraitPeriode;
    libelle: string;
    periode: PeriodeExtrait;
    etabliPar: string;
}
export declare function motifInterruption(e: unknown): string;
export declare class ExtraitsPeriodeService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    numeroter(d: DemandeExtrait): Promise<ExtraitNumerote & {
        id: string;
    }>;
    produire<T>(d: DemandeExtrait, travail: (numeroter: () => Promise<ExtraitNumerote>) => Promise<T>): Promise<T>;
    refuserSiVide(tenantId: string, exerciceId: string, periode: PeriodeExtrait, compteId?: string): Promise<void>;
    libelleDe(tenantId: string, nature: NatureExtraitPeriode, o?: {
        compteId?: string;
        avecGrandsLivres?: boolean;
    }): Promise<string>;
}
