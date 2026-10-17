export declare const FORMAT_LETTRE_CHOISIE: RegExp;
export declare const MOTIF_FORMAT_LETTRE = "La lettre de lettrage se compose d\u2019une \u00E0 quatre lettres, sans chiffre, accent ni signe (A, B, ..., Z, AA, ...).";
export declare function normaliserLettre(lettre: string): string;
export declare function lettreBienFormee(lettre: string): boolean;
export declare function motifLettreDejaEmployee(p: {
    lettre: string;
    compteNumero: string;
    statutGroupe: 'SOLDE' | 'PARTIEL' | null;
    lettreProposee: string;
}): string;
