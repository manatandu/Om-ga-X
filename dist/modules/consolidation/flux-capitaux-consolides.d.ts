import { LigneBalancePourEtat } from '../etats-financiers/etats-financiers.communs';
import { ResultatCumul } from './cumul-consolidation';
import { LigneEtatConsolide } from './etats-consolides';
export declare function lignesAvecMouvements(cumul: ResultatCumul): LigneBalancePourEtat[];
export interface EntreesFluxConsolides {
    cumulN: ResultatCumul;
    cumulN1: ResultatCumul;
    consolidanteN: LigneBalancePourEtat[];
    consolidanteN1: LigneBalancePourEtat[];
    variationsPerimetre: string[];
}
export type ResolveurFlux = (lignesN: LigneBalancePourEtat[], lignesN1: LigneBalancePourEtat[]) => Map<string, number>;
export interface TableauFluxConsolide {
    lignes: LigneEtatConsolide[] | null;
    obstacles: string[];
    controle: {
        tresorerieParLesFlux: number;
        tresorerieParLeBilan: number;
        ecart: number;
        ok: boolean;
    } | null;
}
export declare function construireTableauFluxConsolide(e: EntreesFluxConsolides, flux: ResolveurFlux): TableauFluxConsolide;
export type ColonneCp = 'capital' | 'primes' | 'reserves' | 'resultat' | 'conversion' | 'reevaluation' | 'groupe' | 'minoritaires' | 'total';
export interface LigneVariationCp {
    cle: string;
    libelle: string;
    montants: Record<ColonneCp, number | null>;
    lecture?: string;
}
export interface VariationCapitauxPropres {
    lignes: LigneVariationCp[];
    reserves: string[];
}
export declare function construireVariationCapitauxPropres(cumulN: ResultatCumul, cumulN1: ResultatCumul, consolidanteN: LigneBalancePourEtat[]): VariationCapitauxPropres;
export interface EntiteComparee {
    nom: string;
    estConsolidante: boolean;
    methode: string;
    pctInteret: number;
}
export declare function variationsDuPerimetre(n: EntiteComparee[], n1: EntiteComparee[]): string[];
export type NatureChangementPerimetre = 'ENTREE' | 'SORTIE' | 'METHODE' | 'POURCENTAGE';
export declare function changementsDuPerimetre(n: EntiteComparee[], n1: EntiteComparee[]): {
    nom: string;
    nature: NatureChangementPerimetre;
    motif: string;
}[];
