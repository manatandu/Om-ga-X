import { LigneBalancePourEtat } from '../etats-financiers/etats-financiers.communs';
import { UniteIndicateur } from './indicateurs-note-33';
export declare const INDICATEURS_NOTE_34_LAISSES_EN_SAISIE: string[];
export declare const PRECISION_NOTE_34: string;
interface PosteLu {
    ref?: string;
    montant?: number;
    montantN1?: number;
}
export interface EtatsSyscohadaPourNote34 {
    bilan: {
        actif: PosteLu[];
        passif: PosteLu[];
    };
    compteDeResultat: {
        lignes: PosteLu[];
    };
    fluxTresorerie: {
        lignes: Array<PosteLu | {
            section: string;
        }>;
        exerciceN1Disponible: boolean;
        postesNonCalculables: Array<{
            ref: string;
        }>;
        postesVides?: string[];
    };
}
export interface IndicateurNote34 {
    cle: string;
    unite: UniteIndicateur;
    valeurN: number | null;
    valeurN1: number | null;
}
export declare function indicateursNote34Syscohada(etats: EtatsSyscohadaPourNote34, lignesN: LigneBalancePourEtat[], lignesN1: LigneBalancePourEtat[], exerciceN1Disponible: boolean): IndicateurNote34[];
export {};
