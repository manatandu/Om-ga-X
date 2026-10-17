import { type Tableau } from '../import/lecture-fichier';
export interface LigneReleveLue {
    rang: number;
    date: Date;
    libelle: string;
    reference: string | null;
    debit: number;
    credit: number;
}
export type ChampReleve = 'date' | 'libelle' | 'reference' | 'debit' | 'credit' | 'montant';
export declare function reconnaitreColonnes(colonnes: string[], imposees?: Partial<Record<ChampReleve, string>>): Partial<Record<ChampReleve, number>>;
export declare function lireReleve(tableau: Tableau, index: Partial<Record<ChampReleve, number>>): {
    lignes: LigneReleveLue[];
    anomalies: string[];
};
export declare function arrondi(n: number): number;
export declare function montantVuDuCompte(l: {
    debit: number;
    credit: number;
}): number;
export interface LigneCompte {
    id: string;
    date: Date;
    reference: string | null;
    debit: number;
    credit: number;
}
export interface Proposition {
    ligneReleveId: string;
    ligneEcritureIds: string[];
    motif: 'REFERENCE' | 'MONTANT_DATE';
}
export declare function memeReference(a: string | null, b: string | null): boolean;
export declare const FENETRE_JOURS_DEFAUT = 15;
export declare const FENETRE_JOURS_MAX = 120;
export declare function proposerCorrespondances(releve: (LigneReleveLue & {
    id: string;
})[], compte: LigneCompte[], fenetreJours?: number): Proposition[];
