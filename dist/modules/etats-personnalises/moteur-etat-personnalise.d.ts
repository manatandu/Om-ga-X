export type Mesure = 'SOLDE' | 'MOUVEMENT';
export type Sens = 'DEBIT' | 'CREDIT';
export interface LigneDefinition {
    cle: string;
    libelle: string;
    racines?: string;
    mesure?: Mesure;
    sens?: Sens;
    total?: string;
}
export interface LigneBalanceEtat {
    numero: string;
    totalDebit: number;
    totalCredit: number;
    mouvementDebit: number;
    mouvementCredit: number;
}
export declare const PLAFOND_LIGNES = 100;
export declare const PLAFOND_EXERCICES = 5;
export declare function motifRefusDefinition(lignes: LigneDefinition[]): string | null;
export declare function calculerColonne(lignes: LigneDefinition[], balance: LigneBalanceEtat[]): Record<string, number>;
