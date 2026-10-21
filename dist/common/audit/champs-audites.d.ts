export declare const MODELES_AUDITES: Set<string>;
export declare const NON_AUDITES_MOTIVES: Readonly<Record<string, string>>;
export declare const MARQUEUR_MASQUE = "[masqu\u00E9]";
export declare const COLONNES_EXCLUES_PAR_MODELE: Readonly<Record<string, readonly string[]>>;
export declare function colonnesExclues(modele: string): ReadonlySet<string>;
export declare const COLONNES_JAMAIS_RESTITUEES: Readonly<Record<string, readonly string[]>>;
export declare function colonnesNonRestituables(modele: string): ReadonlySet<string>;
export declare function estChampSensible(nom: string, exclues?: ReadonlySet<string>): boolean;
export declare function masquer(valeur: unknown, exclues?: ReadonlySet<string>): unknown;
