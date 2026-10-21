import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { type FondsRepris } from './reprise-subvention';
export declare class RepriseSubventionService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    lister(tenantId: string, exerciceId: string): Promise<{
        biens: ({
            subvention: number;
            cumulRepris: number;
            montant: number;
            nature: "EXERCICE";
            motif: string;
            comptes14: {
                compteId: string;
                numero: string;
                montant: number;
            }[];
            fonds: FondsRepris | null;
            designation: string;
            dateFin: Date;
            dateSortie: Date | null;
            id: string;
        } | {
            subvention: number;
            cumulRepris: number;
            montant: number;
            nature: import("./reprise-subvention").NatureReprise;
            motif: string | null;
            reserve: string | null;
            reductions: number;
            comptes14: {
                numero: string;
                montant: number;
                compteId: string;
            }[];
            fonds: FondsRepris;
            designation: string;
            dateFin: Date;
            dateSortie: Date | null;
            id: string;
        })[];
        tronque: boolean;
    }>;
    proposer(tenantId: string, immobilisationId: string, exerciceId: string, dureeInalienabiliteAns?: number | null): Promise<{
        subvention: number;
        cumulRepris: number;
        montant: number;
        nature: "EXERCICE";
        motif: string;
        comptes14: {
            compteId: string;
            numero: string;
            montant: number;
        }[];
        fonds: FondsRepris | null;
        designation: string;
        dateFin: Date;
        dateSortie: Date | null;
    } | {
        subvention: number;
        cumulRepris: number;
        montant: number;
        nature: import("./reprise-subvention").NatureReprise;
        motif: string | null;
        reserve: string | null;
        reductions: number;
        comptes14: {
            numero: string;
            montant: number;
            compteId: string;
        }[];
        fonds: FondsRepris;
        designation: string;
        dateFin: Date;
        dateSortie: Date | null;
    }>;
    passer(tenantId: string, userId: string, immobilisationId: string, dto: {
        exerciceId: string;
        journalId: string;
        dureeInalienabiliteAns?: number | null;
    }): Promise<{
        nature: import(".prisma/client").$Enums.NatureRepriseSubvention;
        montant: Prisma.Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        exerciceId: string;
        ecritureId: string;
        immobilisationId: string;
    }>;
}
