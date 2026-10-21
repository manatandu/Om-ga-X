export interface LigneAttendue {
    compte: string;
    sens: 'DEBIT' | 'CREDIT';
    montant: number;
}
export interface LigneDeLEcriture {
    numero: string;
    debit: number;
    credit: number;
}
export declare function lignesManquantes(attendues: LigneAttendue[], lignes: LigneDeLEcriture[]): LigneAttendue[];
export declare function decrireLigne(l: LigneAttendue): string;
