export declare const PAS_SECONDES = 30;
export declare const CHIFFRES = 6;
export declare const FENETRE_PAS = 1;
export declare const NOMBRE_CODES_SECOURS = 8;
export declare function base32(octets: Buffer): string;
export declare function depuisBase32(texte: string): Buffer;
export declare function genererSecret(): string;
export declare function codeHotp(cle: Buffer, compteur: number, chiffres?: number): string;
export declare function pasDe(instantMs: number): number;
export declare function verifierCodeTotp(secret: string, code: string, instantMs: number, dernierPas: number | null): number | null;
export declare function uriOtpauth(secret: string, compte: string, emetteur?: string): string;
export declare function normaliserCodeSecours(code: string): string;
export declare function empreinteCodeSecours(code: string): string;
export declare function genererCodesSecours(n?: number): {
    codes: string[];
    empreintes: string[];
};
export declare function consommerCodeSecours(code: string, empreintes: readonly string[]): string[] | null;
export interface EtatSecondFacteur {
    secretDoubleAuth: string | null;
    dernierPasDoubleAuth: number | null;
    codesSecoursDoubleAuth: string[];
}
export declare function secondFacteurAccepte(u: EtatSecondFacteur, code: string, instantMs: number): {
    dernierPasDoubleAuth: number;
} | {
    codesSecoursDoubleAuth: string[];
} | null;
export declare const SANS_DOUBLE_AUTH: {
    secretDoubleAuth: null;
    doubleAuthActiveDepuis: null;
    dernierPasDoubleAuth: null;
    codesSecoursDoubleAuth: string[];
};
