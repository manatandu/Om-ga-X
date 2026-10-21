import { ClasseCompte } from '@prisma/client';
import { type FeuilleFpm } from './presentation-fpm';
export interface LigneBalanceFpm {
    compteId: string;
    numero: string;
    intitule: string;
    classe: ClasseCompte;
    avantDebit: number;
    avantCredit: number;
    mouvementDebit: number;
    mouvementCredit: number;
    totalDebit: number;
    totalCredit: number;
}
export interface TotauxBalance {
    avantDebit: number;
    avantCredit: number;
    mouvementDebit: number;
    mouvementCredit: number;
    solde: number;
}
export declare const CLASSES_BILAN: Set<import(".prisma/client").$Enums.ClasseCompte>;
export declare const CLASSES_GESTION: Set<import(".prisma/client").$Enums.ClasseCompte>;
export declare const arrondi: (n: number) => number;
export declare function divisionsDeLaClasse9(lignes: readonly LigneBalanceFpm[]): string[];
export declare function ecrireLigneDeCompte(feuille: FeuilleFpm, l: LigneBalanceFpm, libelle: string, feuilleDuCompte: string | undefined): Promise<number>;
export declare function ecrireTotal(feuille: FeuilleFpm, libelle: string, t: TotauxBalance, references: (col: string) => string): Promise<number>;
export declare function totauxBalance(lignes: readonly LigneBalanceFpm[]): TotauxBalance;
export declare function sommeBalance(a: TotauxBalance, b: TotauxBalance): TotauxBalance;
export declare function ecartBalance(a: TotauxBalance, b: TotauxBalance): TotauxBalance;
export declare function estNulBalance(t: TotauxBalance): boolean;
export declare function plageBalance(premiere: number, derniere: number): (col: string) => string;
export interface CorpsBalance {
    ligneDuCompte: Map<string, number>;
    premiere: number | null;
    derniere: number | null;
}
export declare function ecrireCorpsBalance(feuille: FeuilleFpm, lignes: readonly LigneBalanceFpm[], intitulesDivisions: Map<string, string>, feuilleDe?: Map<string, string | undefined>): Promise<CorpsBalance>;
