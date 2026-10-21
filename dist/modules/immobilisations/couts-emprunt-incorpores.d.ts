export type Ref = 'SYSCOHADA' | 'SYCEBNL';
export type NatureEmprunt = 'SPECIFIQUE' | 'GENERAL';
export declare function compteCreditIncorporation(referentiel: Ref, numeroBien: string): string;
export declare function montantIncorporable(o: {
    base: number;
    tauxPourcent: number;
    mois: number;
    produitsPlacement: number;
}): number;
export interface SaisieIncorporation {
    referentiel: Ref;
    numeroBien: string;
    enService: boolean;
    aDesDotations: boolean;
    dateMiseEnService: Date | null;
    nature: NatureEmprunt;
    debutPreparation: Date;
    finPreparation: Date;
    justificationPeriodeCourte: string | null | undefined;
    dateDebut: Date;
    dateFin: Date;
    exercice: {
        dateDebut: Date;
        dateFin: Date;
    };
    base: number;
    tauxPourcent: number;
    produitsPlacement: number;
}
export declare function motifRefusIncorporation(o: SaisieIncorporation): string | null;
export declare function motifRefusMiseEnServiceAvantIncorporation(dateMiseEnService: Date, finDerniereIncorporation: Date | null): string | null;
export declare function motifRefusPlafond(o: {
    montant: number;
    coutsSupportes: number;
    dejaIncorpores: number;
}): string | null;
