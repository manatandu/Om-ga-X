import { FormeJuridiqueSyscohada } from '@prisma/client';
export declare const COMPTES_IMPOT_RESULTAT: {
    readonly charge: "89110000";
    readonly chargeMinimum: "89500000";
    readonly dette: "44100000";
    readonly acomptes: "44920000";
    readonly annulationPertesRetroactives: "89940000";
};
export declare const CONDITIONS_A_DECLARER: Readonly<Partial<Record<FormeJuridiqueSyscohada, string>>>;
export declare const LONGUEUR_MIN_ATTESTATION = 10;
export interface EntreeConstatImpot {
    formeJuridique: FormeJuridiqueSyscohada | null;
    regime: string;
    impotDu: number | null;
    minimumApplique: boolean;
    simulationAvantLaLoi: boolean;
    exerciceClos: boolean;
    brouillardGestion: number;
    impotDejaConstate: number;
    impotConstateAu89: number;
    reintegrationsImpot: number;
    attestationRegime: string | null | undefined;
    periodeCreation?: {
        dateFin: Date;
        dateFinExercice: Date;
        impotDu: number | null;
        minimumApplique: boolean;
    } | null;
    tropPaye?: number;
    motifTotalisation?: string | null;
}
export declare const montantFiscal: (n: number) => string;
export declare function motifsRefusConstat(e: EntreeConstatImpot): string[];
export declare function imputationAcomptes(e: {
    declares: number;
    solde4492: number;
    impot: number;
}): {
    montant: number;
    motifRefus: string | null;
};
export interface LigneProposee {
    numero: string;
    debit: number;
    credit: number;
    libelle: string;
}
export declare function compteDeLaCharge(minimumApplique: boolean): string;
export declare function lignesConstat(impot: number, minimumApplique: boolean, impute: number, tropPaye?: number): LigneProposee[];
