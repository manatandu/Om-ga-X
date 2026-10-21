export type SituationAutorisationDebits = 'AUTORISE' | 'AUTORISE_NON_DATE' | 'AVANT_EFFET' | 'REVOQUEE' | 'NON_AUTORISE';
export type FicheAutorisationDebits = {
    autoriseTvaDebits: boolean;
    dateEffetAutorisationDebits?: Date | null;
    dateRevocationAutorisationDebits?: Date | null;
};
export declare function situationAutorisationDebits(fiche: FicheAutorisationDebits, dateOperation: Date): SituationAutorisationDebits;
export declare function motifRefusPeriodeAutorisationDebits(effet: Date | null | undefined, revocation: Date | null | undefined): string | null;
