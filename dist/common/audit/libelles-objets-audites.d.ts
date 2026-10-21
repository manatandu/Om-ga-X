export declare const LIBELLES_OBJETS_AUDITES: Readonly<Record<string, string>>;
export interface ObjetAudite {
    cle: string;
    libelle: string;
}
export declare function objetsAudites(): ObjetAudite[];
