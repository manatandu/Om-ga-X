export declare const PARAMETRE_RETENUS = "retenus";
export type RegimeListeDeComptes = {
    regime: 'retenus';
} | {
    regime: 'texte';
    motif: string;
};
export declare const LISTES_DE_COMPTES: Readonly<Record<string, RegimeListeDeComptes>>;
export declare const ROUTES_QUI_NE_SONT_PAS_DES_LISTES: Readonly<Record<string, string>>;
