export declare const VERSION_CONDITIONS_LICENCE: {
    readonly numero: 1;
    readonly date: "2026-10-15";
    readonly dateLisible: "15 octobre 2026";
};
export declare const LANGUE_DU_CONTRAT = "fran\u00E7ais";
export interface IdentiteEditeur {
    denomination: string;
    siege: string | null;
    courriel: string | null;
    telephone: string | null;
    immatriculation: {
        formeJuridique: string;
        rccm: string;
        idNat: string;
        numeroImpot: string;
        capitalSocial: string;
    } | 'NON_ASSUJETTIE' | null;
}
export declare const EDITEUR: IdentiteEditeur;
export interface Reclamations {
    courriel: string | null;
    telephone: string | null;
    modalites: string | null;
}
export declare const RECLAMATIONS: Reclamations;
export interface ElementsDeLOffre {
    modalitesPaiement: string | null;
    droitRetractation: string | null;
    garantiesLegales: string | null;
}
export declare const OFFRE: ElementsDeLOffre;
export declare const A_ARRETER = "\u00E0 arr\u00EAter par VMG Consulting";
export declare function mentionsAArreter(editeur?: IdentiteEditeur, reclamations?: Reclamations, offre?: ElementsDeLOffre): string[];
export declare const FORMULES_DU_CONTRAT: {
    code: string;
    libelle: string;
    contenu: string;
}[];
export type AlineaConditions = string | {
    liste: string[];
};
export interface ArticleConditions {
    numero: number;
    titre: string;
    alineas: AlineaConditions[];
}
export declare function articlesDesConditions(editeur?: IdentiteEditeur, reclamations?: Reclamations, offre?: ElementsDeLOffre): ArticleConditions[];
export declare function texteBrutDesConditions(editeur?: IdentiteEditeur, reclamations?: Reclamations, offre?: ElementsDeLOffre): string;
