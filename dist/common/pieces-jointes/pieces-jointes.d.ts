export declare const TAILLE_MAX_DOCUMENT: number;
export declare const LONGUEUR_MAX_COMMENTAIRE = 69;
export declare const LONGUEUR_MAX_NOM = 150;
interface TypeAdmis {
    typeMime: string;
    extensions: readonly string[];
    signature: readonly number[];
}
export declare const TYPES_ADMIS: readonly TypeAdmis[];
export declare function nettoyerNomFichier(nom: string): string;
export declare function decoderNomMultipart(nom: string): string;
export declare function identifierType(contenu: Buffer, nom: string): {
    typeMime: string;
} | {
    refus: string;
};
export interface PieceDeposee {
    nom: string;
    contenu: Buffer;
    commentaire?: string | null;
}
export declare function motifRefusDocument(piece: PieceDeposee): string | null;
export declare function empreinteDocument(contenu: Buffer): string;
export declare function dispositionTelechargement(nom: string): string;
export declare function entetesTelechargement(piece: {
    nomFichier: string;
    typeMime: string;
}): Record<string, string>;
export {};
