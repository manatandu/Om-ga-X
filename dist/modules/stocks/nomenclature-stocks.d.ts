import { Referentiel } from '@prisma/client';
export interface CorrespondanceStock {
    racine: string;
    intitule: string;
    variation: string;
    intituleVariation: string;
}
export interface StockHorsVariation {
    racine: string;
    referentiels: Referentiel[];
    intitule: string;
    motif: string;
}
export declare const STOCKS_HORS_VARIATION_AUTOMATIQUE: StockHorsVariation[];
export declare const STOCK_PROVENANT_D_IMMOBILISATIONS: Readonly<Record<Referentiel, {
    racine: string;
    intitule: string;
    source: string;
}>>;
export declare function correspondancesDuReferentiel(referentiel: Referentiel): CorrespondanceStock[];
export declare function variationDuCompte(numero: string, referentiel: Referentiel): CorrespondanceStock | null;
export declare function motifHorsVariation(numero: string, referentiel: Referentiel): StockHorsVariation | null;
