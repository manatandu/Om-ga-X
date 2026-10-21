export declare const AVERTISSEMENT_ARTICLE_89: string;
export { jourDeKinshasa } from '../../common/echeance';
export declare function jourLisible(jour: Date): string;
export declare function usdEnFc(montantUsd: number, cours: number): number;
export declare const AVERTISSEMENT_DATE_DU_CALCUL: string;
export declare function messageCoursManquant(jour: Date, miseADispositionDeclaree?: boolean): string;
export declare const DEVISE_DE_LA_PAIE = "USD";
export declare function motifRefusCotationGestionnairePaie(codeDevise: string, dateCours: string, maintenant: Date): string | null;
export declare function messageCoursDejaCote(jour: Date): string;
