import * as ExcelJS from 'exceljs';
import { IdentiteLiasse, NiveauLigne } from './theme-etafi';
export interface GroupeColonnes {
    titre: string;
    sousTitres: string[];
}
export interface LigneEtatEtafi {
    ref: string;
    cle?: string;
    libelle: string;
    note: string;
    niveau: NiveauLigne;
    montants: Array<number | {
        formule: string;
    } | null>;
}
export declare const TOTAUX_ASSOCIATIONS: Record<string, string>;
export declare const NIVEAUX_ETAT_ASSOCIATIONS: Record<string, NiveauLigne>;
export declare const NOTE_PAR_REF_ASSOCIATIONS: Record<string, string>;
export declare const REP_TFT: Record<string, string>;
export declare const NIVEAUX_TFT: Record<string, NiveauLigne>;
export interface OptionsFeuilleEtat {
    nom: string;
    titre: string;
    taille?: number;
    ident: IdentiteLiasse;
    pageRef?: string;
    libelleColonne: string;
    groupes: GroupeColonnes[];
    lignes: LigneEtatEtafi[];
    totaux?: Record<string, string>;
    largeurLibelle?: number;
}
export declare function construireFeuilleEtat(wb: ExcelJS.Workbook, options: OptionsFeuilleEtat): Map<string, number>;
export declare function ligneControleSousEtat(ws: ExcelJS.Worksheet, rang: number, texte: string): void;
export interface VentilationEcheance {
    nonEchu: number;
    echu: number;
    nonVentile: number;
}
export declare const ENTETES_VENTILATION_ECHEANCE: readonly ["Dont non échu au 31/12/N", "Dont échu au 31/12/N", "Part non ventilée · signal de tenue"];
export declare function ecrireVentilationEcheance(ws: ExcelJS.Worksheet, rang: number, colDebut: number, v: VentilationEcheance): void;
export declare function texteControleEcheances(motif: string | null, creancesNonVentilees: number, dettesNonVentilees: number): string;
export declare const TOTAUX_PROJETS_BILAN: Record<string, string>;
export declare const CLE_ETAFI_PAR_CLE_PROJET: Record<string, string>;
export declare const TOTAUX_PROJETS_CE: Record<string, string>;
export declare const NIVEAUX_ETAT_PROJETS: Record<string, NiveauLigne>;
export declare const NOTE_PAR_CLE_PROJETS: Record<string, string>;
export declare const TOTAUX_TER: Record<string, string>;
export declare const NIVEAUX_TER: Record<string, NiveauLigne>;
export declare const NIVEAUX_RECONCILIATION: Record<string, NiveauLigne>;
export declare const TOTAUX_SYSCOHADA: Record<string, string>;
export declare const NIVEAUX_ETAT_SYSCOHADA: Record<string, NiveauLigne>;
export declare const NOTE_PAR_REF_SYSCOHADA: Record<string, string>;
export declare const REP_TFT_SYSCOHADA: Record<string, string>;
export declare const NIVEAUX_TFT_SYSCOHADA: Record<string, NiveauLigne>;
