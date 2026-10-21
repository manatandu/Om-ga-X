export interface LigneDevise {
    debit?: number | null;
    credit?: number | null;
    deviseId?: string | null;
    montantDevise?: number | null;
    coursApplique?: number | null;
}
export declare function porteUneDevise(l: LigneDevise): boolean;
export declare function contrevaleur(montantDevise: number, cours: number): number;
export declare function contrevaleurAdmise(montantDevise: number, cours: number, francs: number): boolean;
export declare function motifRefusLigneEnDevise(l: LigneDevise, devise: {
    code: string;
} | undefined): string | null;
export declare function coursDeLaLigne(l: LigneDevise): number | undefined;
