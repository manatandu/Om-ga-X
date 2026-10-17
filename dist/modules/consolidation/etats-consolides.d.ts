import { CompteDuPoste, LigneBalancePourEtat } from '../etats-financiers/etats-financiers.communs';
import type { ResolutionBilan, ResolutionCompteResultat } from '../etats-financiers-syscohada/etats-financiers-syscohada.service';
import { ResultatCumul } from './cumul-consolidation';
export type NatureLigne = 'POSTE' | 'DETAIL' | 'TOTAL' | 'A_RETRAITER';
export interface LigneEtatConsolide {
    cle: string;
    libelle: string;
    nature: NatureLigne;
    brut?: number | null;
    amortissement?: number | null;
    net: number | null;
    netN1?: number | null;
    lecture?: string;
    reserve?: string;
}
export interface ControleEtatConsolide {
    cle: string;
    libelle: string;
    ecart: number;
    ok: boolean;
}
export interface EtatsConsolides {
    bilan: {
        actif: LigneEtatConsolide[];
        passif: LigneEtatConsolide[];
    };
    compteDeResultat: LigneEtatConsolide[];
    controles: ControleEtatConsolide[];
    publiable: boolean;
    motifsNonPubliable: string[];
}
export interface Resolveurs {
    bilan(lignes: LigneBalancePourEtat[]): {
        resolution: ResolutionBilan;
        nonRattaches: CompteDuPoste[];
    };
    compteResultat(lignes: LigneBalancePourEtat[]): ResolutionCompteResultat;
}
export declare function lignesPourResolution(cumul: ResultatCumul): LigneBalancePourEtat[];
export declare function construireEtatsConsolides(cumul: ResultatCumul, resolveurs: Resolveurs): EtatsConsolides;
export declare function apparierN1(n: LigneEtatConsolide[], n1: LigneEtatConsolide[] | null): LigneEtatConsolide[];
