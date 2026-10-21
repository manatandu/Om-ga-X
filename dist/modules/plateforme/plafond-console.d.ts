export declare const PLAFOND_LISTE_CONSOLE = 500;
export interface TrancheConsole {
    total: number;
    tronque: boolean;
    plafond: number;
}
export declare function tranche(rendus: number, total: number): TrancheConsole;
