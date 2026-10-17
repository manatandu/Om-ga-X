export type AvanceARetenir = {
    readonly avanceId: string;
    readonly type: 'AVANCE' | 'ACOMPTE' | 'PRET' | 'SAISIE_ARRET';
    readonly dateOctroi: string;
    readonly libelle: string;
    readonly soldeFc: number;
};
export type RetenueProposee = {
    readonly avanceId: string;
    readonly littera: 'c' | 'f';
    readonly libelle: string;
    readonly soldeFc: number;
    readonly montantProposeFc: number;
    readonly reserve: string | null;
};
export type PropositionRetenues = {
    readonly retenues: readonly RetenueProposee[];
    readonly saisiesNonProposees: readonly {
        avanceId: string;
        libelle: string;
        soldeFc: number;
    }[];
    readonly netDisponibleFc: number | null;
    readonly resteNonRetenuFc: number;
    readonly reserves: readonly string[];
};
export declare const RESERVE_PRET_EXIGIBILITE: string;
export declare const RESERVE_NET_NON_CHIFFRE: string;
export declare const RESERVE_SAISIE_NON_PROPOSEE: string;
export declare const FONDEMENT_RETENUES_DECOMPTE: string;
export declare function propositionRetenuesDecompte(avances: readonly AvanceARetenir[], netDisponibleFc: number | null): PropositionRetenues;
export declare function avertissementsSoldesRestants(avances: readonly AvanceARetenir[], retenuesFc: Readonly<Record<string, number>>): string[];
export type GratificationStipulee = {
    readonly montantAnnuelFc: number;
    readonly source: string;
    readonly debutPeriode: string;
    readonly finPeriode: string;
};
export type PropositionGratification = {
    readonly montantFc: number;
    readonly moisEntiers: number;
    readonly base: string;
};
export declare function moisEntiersDeService(debut: Date, finIncluse: Date): number;
export declare const MOIS_DE_LA_PERIODE_DE_GRATIFICATION = 12;
export declare function motifRefusGratificationStipulee(g: GratificationStipulee): string | null;
export declare const RESERVE_PRORATA_GRATIFICATION: string;
export declare function propositionGratification(g: GratificationStipulee): PropositionGratification | null;
export type IndemniteStipulee = {
    readonly montantFc: number;
    readonly source: string;
};
export declare function motifRefusIndemniteStipulee(i: IndemniteStipulee): string | null;
export declare const FONDEMENT_INDEMNITE_STIPULEE: string;
