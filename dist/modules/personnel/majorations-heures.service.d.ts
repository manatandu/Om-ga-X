import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { type NatureMajoration } from './heures-majorees';
import { MajorationHeuresDto } from './dto/majorations.dto';
type Db = PrismaService | Prisma.TransactionClient;
export type HeuresPortee = {
    readonly majorationId: string;
    readonly nature: NatureMajoration;
    readonly heures: number;
    readonly tauxHoraire: number;
    readonly tauxPourCent: number;
    readonly source: string;
    readonly libelle: string;
    readonly montant: number;
};
export declare function heuresAPorter(db: Db, tenantId: string, moisDePaie: string, lignes: readonly {
    majorationId: string;
    heures: number;
    tauxHoraire: number;
}[]): Promise<HeuresPortee[]>;
export declare class MajorationsHeuresService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        natures: {
            libelle: string;
            fondement: string;
            heureEntiere: boolean;
            cle: string;
        }[];
        majorations: {
            id: string;
            nature: import(".prisma/client").$Enums.NatureMajorationHeures;
            libelle: string;
            tauxPourCent: number;
            source: string;
            dateEffet: string;
            actif: boolean;
            desactiveLe: Date | null;
            creePar: string;
        }[];
        tronque: boolean;
    }>;
    creer(tenantId: string, userEmail: string, dto: MajorationHeuresDto): Promise<{
        id: string;
    }>;
    desactiver(tenantId: string, userEmail: string, id: string): Promise<{
        desactive: boolean;
    }>;
}
export {};
