export interface ComptesDeLaNature {
    comptes: string[];
    remarque: string;
}
export interface CorrespondanceBareme {
    cle: string;
    SYSCOHADA: ComptesDeLaNature;
    SYCEBNL: ComptesDeLaNature;
}
export declare const CORRESPONDANCE_BAREME_COMPTES: readonly CorrespondanceBareme[];
