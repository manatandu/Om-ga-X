export declare const BORNES_PORTEES: Readonly<Record<string, readonly string[]>>;
export declare class ModeleSansBorne extends Error {
    constructor(modele: string);
}
export declare function borneDuModele(modele: string, tenantId: string): Record<string, unknown>;
export declare const ORDRE_PAR_MODELE: Readonly<Record<string, string>>;
export declare function ordreDuModele(modele: string): string;
export declare function colonnesDuModele(modele: string): string[];
export declare const TABLES_RESTITUEES: readonly string[];
export declare const TABLE_DU_DOSSIER = "Tenant";
export declare const TABLES_DE_L_ARCHIVE: readonly string[];
export declare function fichierDeLaTable(modele: string): string;
export declare function fichierDuDocument(id: string, nomFichier: string): string;
export declare function fichierDeLaPieceVirement(id: string, nomFichier: string): string;
export declare const TABLES_DE_PIECES: ReadonlyArray<{
    modele: string;
    dossier: string;
    filtre?: Readonly<Record<string, unknown>>;
    nomParDefaut?: string;
}>;
export declare function fichierDeLaPiece(dossier: string, id: string, nomFichier: string): string;
export declare function fichierDeLExport(id: string, nomFichier: string): string;
export declare function fichierDeLImpression(id: string, nomFichier: string): string;
