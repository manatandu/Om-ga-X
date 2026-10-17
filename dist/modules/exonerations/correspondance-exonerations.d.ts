export type TypeDemandeExoneration = 'PONCTUEL' | 'PREVISIONNEL' | 'RENOUVELLEMENT';
export interface PieceDemandee {
    cle: string;
    libelle: string;
    conditionnelle?: string;
}
export interface ModeleDemande {
    type: TypeDemandeExoneration;
    libelle: string;
    objet: string;
    baseLegale: string;
    validiteMois: number | null;
    pieces: PieceDemandee[];
}
export declare const MODELES_DEMANDE: ModeleDemande[];
export declare const FRANCHISES_DOUANIERES_EBNL: readonly [{
    readonly lettre: "e";
    readonly libelle: "Dons distribués gratuitement par un organisme charitable agréé";
    readonly texte: string;
}, {
    readonly lettre: "h";
    readonly libelle: "Matériels et articles destinés à la recherche ou à l'éducation";
    readonly texte: "Matériels et articles destinés à la recherche et/ou à l'éducation.";
}, {
    readonly lettre: "i";
    readonly libelle: "Objets religieux destinés à l'exercice du culte";
    readonly texte: "Objets religieux destinés à être utilisés dans l'exercice du culte.";
}, {
    readonly lettre: "l";
    readonly libelle: "Dons ou matériels fournis gratuitement à l'État ou à une entité territoriale";
    readonly texte: string;
}, {
    readonly lettre: "m";
    readonly libelle: "Marchandises importées dans le cadre de la coopération bilatérale ou multilatérale";
    readonly texte: "Marchandises importées dans le cadre des projets de coopération bilatérale ou multilatérale.";
}];
export declare const JOURS_ALERTE_RENOUVELLEMENT = 60;
export declare const AVERTISSEMENT_FRANCHISE: string;
