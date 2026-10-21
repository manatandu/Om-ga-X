import { LigneBalancePourEtat } from '../etats-financiers/etats-financiers.communs';
export interface PostePourIndicateurs {
    ref: string;
    montant: number;
    montantN1?: number;
}
export interface EtatsPourIndicateurs {
    bilan: {
        actif: PostePourIndicateurs[];
        passif: PostePourIndicateurs[];
    };
    compteDeResultat: {
        produits: PostePourIndicateurs[];
        charges: PostePourIndicateurs[];
        totalCharges: number;
        totalChargesN1?: number;
        resultatActivitesOrdinaires: number;
        resultatActivitesOrdinairesN1?: number;
        resultatHao: number;
        resultatHaoN1?: number;
        resultatNet: number;
        resultatNetN1?: number;
    };
    fluxTresorerie: {
        lignes: Array<{
            ref?: string;
            montant?: number;
            montantN1?: number;
        } | {
            section: string;
        }>;
        postesVides?: string[];
    };
}
export type UniteIndicateur = 'MONTANT' | 'POURCENT';
export declare const MILLIERS_DE_FRANCS = 1000;
export interface IndicateurCalcule {
    cle: string;
    unite: UniteIndicateur;
    valeurN: number | null;
    valeurN1: number | null;
}
export interface CessionsImmobilisations {
    valeurComptable: number;
    produits: number;
    dotationsHao: number;
    reprisesHao: number;
}
export declare function cessionsDeLExercice(lignes: LigneBalancePourEtat[]): CessionsImmobilisations;
export declare const INDICATEURS_LAISSES_EN_SAISIE: string[];
export declare function indicateursNote33(etats: EtatsPourIndicateurs, cessionsN: CessionsImmobilisations, cessionsN1: CessionsImmobilisations, exerciceN1Disponible: boolean): IndicateurCalcule[];
