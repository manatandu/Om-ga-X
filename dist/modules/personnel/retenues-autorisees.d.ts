export type LitteraArticle112 = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
export type RetenueAutorisee = {
    readonly littera: LitteraArticle112;
    readonly libelle: string;
    readonly equivalentActuel: string | null;
};
export declare const RETENUES_ARTICLE_112: readonly RetenueAutorisee[];
export declare const SANCTION_ARTICLE_112: string;
export declare const REPONSE_COTISATION_SYNDICALE: string;
export declare const RESERVE_CESSION_SYNDICALE: string;
export declare const RESERVE_LITTERAE_DATEES: string;
export declare function retenueAutorisee(littera: string | null | undefined): {
    readonly autorisee: boolean;
    readonly retenue: RetenueAutorisee | null;
    readonly refus: string | null;
};
