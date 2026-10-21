import type { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
export declare const MAX_LIGNES_EXPORT: number;
export declare const LOT_EXPORT = 500;
export declare function confronterAuDecompte(lues: number, comptees: number, quoi: string): void;
export declare const OPTIONS_CLASSEUR_EN_FLUX: {
    readonly useSharedStrings: false;
    readonly useStyles: true;
};
export declare const LIGNES_COIFFE = 3;
export declare const LIGNE_ENTETE: number;
export declare const PREMIERE_LIGNE_DONNEES: number;
export interface IdentiteEtat {
    entite: string;
    nif: string;
    periode: string;
    devise: string;
    immatriculation?: string;
}
export declare function segmentIdentification(identite: IdentiteEtat): string;
export declare function attendreLeTuyau(sortie: Writable): Promise<void>;
export interface ParametresFeuilleEnFlux {
    nomFeuille: string;
    titre: string;
    identite: IdentiteEtat;
    colonnes: Partial<ExcelJS.Column>[];
    editeLe?: string;
}
export declare const LONGUEUR_MAX_ENTETE_IMPRESSION = 255;
export declare function enTeteImpression(gauche: string, centre: string | null, droiteCodee: string): string;
export declare function poserFeuille(classeur: ExcelJS.stream.xlsx.WorkbookWriter, sortie: Writable, params: ParametresFeuilleEnFlux): {
    feuille: ExcelJS.Worksheet;
    nbColonnes: number;
    ajouter(valeurs: Record<string, unknown>): Promise<number>;
    derniereLigneDonnees: () => number;
    fermer(derniereLigneFiltrable?: number): void;
};
export type FeuilleEnFlux = ReturnType<typeof poserFeuille>;
export declare function ouvrirFeuilleEnFlux(params: ParametresFeuilleEnFlux & {
    sortie: Writable;
}): {
    classeur: ExcelJS.stream.xlsx.WorkbookWriter;
    feuille: ExcelJS.Worksheet;
    nbColonnes: number;
    ajouter: (valeurs: Record<string, unknown>) => Promise<number>;
    derniereLigneDonnees: () => number;
    terminer(derniereLigneFiltrable?: number, suivantes?: (ajouterFeuille: (p: ParametresFeuilleEnFlux) => FeuilleEnFlux) => Promise<void>): Promise<void>;
};
