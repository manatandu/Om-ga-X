import * as ExcelJS from 'exceljs';
export interface EnteteColonne {
    groupe: string;
    sens: string;
}
export interface EnteteAttendu {
    groupe: RegExp;
    sens: 'Débit' | 'Crédit';
}
export interface PlageCitee {
    feuilleSource: string;
    celluleSource: string;
    feuille: string;
    colonne: string;
    de: number;
    a: number;
}
export declare function enteteDeColonne(feuille: ExcelJS.Worksheet, colonne: string): EnteteColonne;
export declare function estLigneDeCompte(feuille: ExcelJS.Worksheet, rang: number): boolean;
export declare function plagesCitees(wb: ExcelJS.Workbook): PlageCitee[];
export declare function defautsDePlage(wb: ExcelJS.Workbook, p: PlageCitee, attendu: EnteteAttendu): string[];
export declare function evaluerSomme(wb: ExcelJS.Workbook, formule: string): number;
export interface VerdictControle {
    bloc: string;
    colonnes: [string, string];
    sommes: [number, number];
    verdict: string;
}
export declare function verdictsControleBalance(wb: ExcelJS.Workbook): VerdictControle[];
export declare function enteteAttenduDe(wb: ExcelJS.Workbook, p: PlageCitee): EnteteAttendu;
export declare function defautsDesFormulesDeBalance(wb: ExcelJS.Workbook): {
    plages: PlageCitee[];
    defauts: string[];
};
export interface LigneServeur {
    reportDebit: number;
    reportCredit: number;
    mouvementDebit: number;
    mouvementCredit: number;
    solde: number;
}
export declare function sommeAttendue(lignes: readonly LigneServeur[], colonne: string): number;
export declare function defautsDeFeuilleBalance(wb: ExcelJS.Workbook, nom: string, numerosAttendus: readonly string[], avant: string, fondEntete: string): string[];
