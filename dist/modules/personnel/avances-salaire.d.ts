export type TypeAvance = 'AVANCE' | 'ACOMPTE' | 'PRET' | 'SAISIE_ARRET';
export type CategoriePret = 'IMMOBILIER' | 'MOBILIER_ET_INSTALLATION' | 'AUTRE';
export declare const LITTERA_ARTICLE_112: Readonly<Record<TypeAvance, 'c' | 'f' | 'g'>>;
export declare function compteDeLAvance(type: TypeAvance, categorie: CategoriePret | null): {
    compte: string;
    intitule: string;
};
export declare function motifRefusAvance(a: {
    type: TypeAvance;
    categoriePret?: CategoriePret | null;
    montantFc: number;
    retenueMensuelleFc?: number | null;
    objet?: string;
    pieceJustificative?: string;
    referenceActe?: string | null;
    greffe?: string | null;
    destinataire?: string | null;
}): string | null;
export declare function soldeAvance(montantFc: number, retenues: readonly {
    montantFc: number;
    bulletinAnnule: boolean;
}[]): number;
export declare function motifRefusRetenue(montantFc: number, soldeFc: number, libelle: string): string | null;
export declare const RESERVE_QUOTITE_AVANCES: string;
export declare function motifRefusSaisieArret(a: {
    type: TypeAvance;
    categoriePret?: CategoriePret | null;
    referenceActe?: string | null;
    greffe?: string | null;
    destinataire?: string | null;
}): string | null;
export declare function motifRefusMoisSaisie(moisDePaie: string, dateNotification: Date, dateFin: Date | null): string | null;
export declare function motifRefusFinSaisie(a: {
    type: TypeAvance;
    dateOctroi: Date;
    dateFin: Date | null;
}, dateFin: Date): string | null;
export declare function reserveQuotiteSaisies(saisiesFc: number, quotiteFc: number | null): string | null;
