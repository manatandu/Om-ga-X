import type { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { type IdentiteEtat } from './classeur-en-flux';
export declare const FORMAT_MONTANT_FPM = "#\\\u00A0##0.00";
export declare const FORMAT_DATE_FPM = "dd\\/mm\\/yy";
export declare const FOND_ENTETE_FPM = "FF4F81BD";
export declare const LIGNE_ENTETE_FPM = 8;
export declare function montantFpm(n: number): number | null;
export declare function soldeEnDeuxColonnes(solde: number): {
    debit: number | null;
    credit: number | null;
};
export declare function tirageAKinshasa(instant?: Date): string;
export declare function nomsDeFeuilles(numeros: readonly string[], reserves: readonly string[]): string[];
export declare function formuleLien(feuille: string, cellule: string, texte: string): ExcelJS.CellFormulaValue;
export declare const POLICE_LIEN: Partial<ExcelJS.Font>;
export interface ColonneFpm {
    cle: string;
    largeur: number;
    genre: 'texte' | 'montant' | 'date';
    filetDroit?: boolean;
    filetGauche?: boolean;
}
export interface EnteteFpm {
    colonne: number;
    ligne: 0 | 1;
    texte: string;
    jusquA?: number;
    surDeuxLignes?: boolean;
}
export interface ParametresFeuilleFpm {
    nomFeuille: string;
    titre: string;
    sousTitre: string;
    identite: IdentiteEtat;
    debut: Date;
    fin: Date;
    colonnes: ColonneFpm[];
    entetes: EnteteFpm[];
    lignesEntete: 1 | 2;
    retour?: ExcelJS.CellFormulaValue;
    mention?: string;
}
export declare function poserFeuilleFpm(classeur: ExcelJS.stream.xlsx.WorkbookWriter | ExcelJS.Workbook, sortie: Writable | null, p: ParametresFeuilleFpm): {
    feuille: ExcelJS.Worksheet;
    ajouter: (valeurs: Record<string, unknown>, options?: LigneFpm) => Promise<number>;
    derniereLigne: () => number;
    premiereLigneDonnees: number;
    fermer: () => void;
};
export interface LigneFpm {
    gras?: boolean;
    filetHaut?: boolean;
    lien?: {
        colonne: number;
        valeur: ExcelJS.CellFormulaValue;
    };
}
export type FeuilleFpm = ReturnType<typeof poserFeuilleFpm>;
export declare const COLONNES_GRAND_LIVRE_FPM: ColonneFpm[];
export declare const ENTETES_GRAND_LIVRE_FPM: EnteteFpm[];
export declare const COLONNES_BALANCE_FPM: ColonneFpm[];
export declare function libelleAvantPeriode(debut: Date): string;
export declare function entetesBalanceFpm(debut: Date, libelleNumero: string, libelleIntitule: string): EnteteFpm[];
