import { ClasseCompte, Prisma, TypeCompteDetailTotal } from '@prisma/client';
import { type PeriodeExtrait } from './periode-extrait';
export declare function filtresDesTroisColonnes<F extends object>(filtreEcriture: F): {
    reports: F & {
        estGenereeParCloture: boolean;
        estSoldeDesComptesDeGestion: boolean;
    };
    mouvements: F & {
        estGenereeParCloture: boolean;
    };
    clotures: F & {
        estSoldeDesComptesDeGestion: boolean;
    };
};
export declare function filtresDesTroisColonnesDeLaPeriode(filtreEcriture: Prisma.EcritureWhereInput, periode: PeriodeExtrait): {
    reports: Prisma.EcritureWhereInput;
    mouvements: Prisma.EcritureWhereInput;
    clotures: Prisma.EcritureWhereInput;
};
export interface AgregatsBalance {
    totalDebit: number;
    totalCredit: number;
    reportDebit: number;
    reportCredit: number;
    mouvementDebit: number;
    mouvementCredit: number;
    clotureDebit: number;
    clotureCredit: number;
}
type Groupe = {
    compteId: string;
    _sum: {
        debit: unknown;
        credit: unknown;
    };
};
export declare function agregatsParCompte(reports: Groupe[], mouvements: Groupe[], clotures: Groupe[]): Map<string, AgregatsBalance>;
export interface CompteDeBalance {
    id: string;
    numero: string;
    intitule: string;
    classe: ClasseCompte;
    typeCompte: TypeCompteDetailTotal;
}
export interface LigneDeBalance extends AgregatsBalance {
    compteId: string;
    numero: string;
    intitule: string;
    classe: ClasseCompte;
    typeCompte: TypeCompteDetailTotal;
    solde: number;
}
export declare function lignesDeBalance(comptes: readonly CompteDeBalance[], parCompte: Map<string, AgregatsBalance>): LigneDeBalance[];
export declare function totauxDeBalance(lignes: readonly LigneDeBalance[]): {
    debit: number;
    credit: number;
};
export declare function avantSoldeDesComptesDeGestion<L extends {
    totalDebit: number;
    totalCredit: number;
    solde: number;
    clotureDebit?: number;
    clotureCredit?: number;
}>(lignes: readonly L[]): L[];
export {};
