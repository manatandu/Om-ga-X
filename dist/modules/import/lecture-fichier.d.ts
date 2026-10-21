export interface Tableau {
    colonnes: string[];
    lignes: string[][];
    separateur?: string;
    lignesSupprimees?: number;
}
export declare function analyserCsv(texte: string, separateur: string, options?: {
    elaguer?: boolean;
}): string[][];
export declare function ecrireCelluleCsv(valeur: string, separateur: string): string;
export declare function ecrireCsv(colonnes: string[], lignes: string[][], separateur?: string): string;
export declare function lireFichier(nomFichier: string, contenuBase64: string, separateur?: string): Promise<Tableau>;
export declare function lireMontant(valeur: string): number | null;
export declare function lireDate(valeur: string): Date | null;
