import { EtatsIfrs } from './etats-ifrs';
export type CategorieFlux = 'OPERATIONNELLE' | 'INVESTISSEMENT' | 'FINANCEMENT' | 'IMPOTS' | 'ABANDONNEES';
export declare const CATEGORIES_FLUX: CategorieFlux[];
export interface EntreesFluxIfrs {
    etat: EtatsIfrs;
    fluxLegaux: Record<string, number>;
    cafgParCategorie: Record<CategorieFlux, number>;
    tresorerie: {
        ouverture: number;
        cloture: number;
        horsTresorerieIfrs: {
            numero: string;
            intitule: string;
            activite: 'INVESTISSEMENT' | 'FINANCEMENT';
            variation: number;
        }[];
        horsBilanLegal: string[];
        decouvertsInclus: number;
        tresoreriePassive: boolean;
    };
    declarations: {
        decouvertsDansTresorerie: boolean | null;
        tresorerieEnDevises: boolean | null;
        effetChange: {
            montant: number;
            categorie: 'OPERATIONNELLE' | 'INVESTISSEMENT' | 'FINANCEMENT';
        } | null;
    };
    reservesLegales: string[];
    consolidation?: {
        dividendesRecusMe: number;
        dividendesMinoritaires: number;
        activiteSelonParagraphe34B: boolean;
    };
}
export interface LigneFluxIfrs {
    cle: string;
    libelle: string;
    ref?: string;
    section: 'EXPLOITATION' | 'INVESTISSEMENT' | 'FINANCEMENT' | 'TRESORERIE';
    nature: 'FLUX' | 'TOTAL' | 'SOLDE' | 'ECART';
    montant: number;
}
export interface TableauFluxIfrs {
    lignes: LigneFluxIfrs[];
    rapprochementSituation: {
        cle: string;
        libelle: string;
        montant: number;
    }[];
    rapprochementLegal: {
        activite: string;
        syscohada: number;
        ifrs: number;
        ecart: number;
    }[];
    mentions: string[];
    motifsNonPubliable: string[];
}
export declare function construireFluxTresorerieIfrs(p: EntreesFluxIfrs): TableauFluxIfrs;
