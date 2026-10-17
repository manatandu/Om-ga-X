export declare const ENTETE_CHIFFREE: Buffer<ArrayBuffer>;
export declare const LONGUEUR_PHRASE_MIN = 12;
export declare function motifRefusPhrase(phrase: string | null | undefined): string | null;
export declare function nouveauSel(): Buffer;
export declare function deriverCle(phrase: string, sel: Buffer): Buffer;
export declare function chiffrerFichier(source: string, cible: string, cle: Buffer, sel: Buffer): Promise<void>;
export declare function dechiffrerFichier(source: string, cible: string, phrase: string): Promise<void>;
