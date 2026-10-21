import { PrismaService } from '../../common/prisma.service';
import { type LigneDeBalance } from '../comptabilite/balance-trois-colonnes';
export interface CoupleDossierExercice {
    tenantId: string;
    exerciceId: string;
}
export declare const TRANCHE_DOSSIERS = 20;
export type LigneBalanceDossier = LigneDeBalance;
export interface BalanceDossier {
    lignes: LigneBalanceDossier[];
    totaux: {
        debit: number;
        credit: number;
    };
}
export declare function balancesDesDossiers(prisma: PrismaService, couples: readonly CoupleDossierExercice[]): Promise<Map<string, BalanceDossier>>;
export interface ComptageDossier {
    nbEcritures: number;
    nbBrouillard: number;
    nbProvisoiresAuBrouillard: number;
    derniereEcriture: Date | null;
}
export declare function comptagesDesDossiers(prisma: PrismaService, couples: readonly CoupleDossierExercice[]): Promise<Map<string, ComptageDossier>>;
