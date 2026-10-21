export interface LigneAContrePasser {
    compteId: string;
    compteNumero: string;
    debit: number;
    credit: number;
}
export interface MontantAContrePasser {
    compteId: string;
    compteNumero: string;
    netCentimes: number;
}
export declare function montantsAContrePasser(lignes: LigneAContrePasser[]): MontantAContrePasser[];
export declare function libelleMontantsAContrePasser(montants: MontantAContrePasser[]): string;
export declare function libelleMontantsDeLEcart(montants: MontantAContrePasser[]): string;
export declare function motifRefusInversion(attendus: MontantAContrePasser[], lignesDeLEcriture: LigneAContrePasser[]): string | null;
export declare function disponibilitesInversees(realisees: LigneAContrePasser[], lignesDeLEcriture: LigneAContrePasser[], estDisponibilite: (numero: string) => boolean): Set<string>;
export type VerdictDeLEtat = 'EN_PLACE' | 'CONTRE_PASSEE' | 'ANOMALIE' | 'AMBIGU';
export declare const PLAFOND_SOUS_ENSEMBLES = 12;
export declare function verdictDeLEtat(p: {
    comptes: string[];
    lu: Map<string, number>;
    enPlace: Array<{
        id: string;
        ecart: Map<string, number>;
    }>;
    reevaluationId: string;
}): {
    verdict: VerdictDeLEtat;
    attendu: Map<string, number>;
    trop: boolean;
};
export interface EcritureSurLEcart {
    id: string;
    numeroPiece: number | null;
    date: Date;
    dansLaCible: boolean;
    exacte: boolean;
    horsDeLEcart: boolean;
    dansLeSens: boolean;
    effet: Map<string, number>;
}
export type GesteDIssue = {
    type: 'RETABLIR';
} | {
    type: 'NEUTRALISER';
    ecritures: EcritureSurLEcart[];
};
export type IssueDeLEtat = {
    gestes: GesteDIssue[];
    fin: 'CONTRE_PASSER';
} | {
    gestes: GesteDIssue[];
    fin: 'DECLARER';
    ecriture: EcritureSurLEcart;
};
export interface JugementDeLEtat {
    verdict: VerdictDeLEtat;
    attendu: Map<string, number>;
    lu: Map<string, number>;
    trop: boolean;
    issue: IssueDeLEtat | null;
}
export declare function jugerLEtat(p: {
    comptes47: string[];
    comptesTiers: string[];
    lu47: Map<string, number>;
    ecartTiers: Map<string, number>;
    enPlace: Array<{
        id: string;
        ecart: Map<string, number>;
    }>;
    reevaluationId: string;
    ecartX: Map<string, number>;
    retablissable: boolean;
    ecritures: EcritureSurLEcart[] | null;
}): JugementDeLEtat;
