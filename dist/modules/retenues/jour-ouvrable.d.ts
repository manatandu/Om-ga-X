export declare const JOURS_FERIES: ReadonlyArray<{
    mois: number;
    jour: number;
    nom: string;
}>;
export declare function jourFerie(date: Date): string | null;
export type NatureEcheance = 'DECLARATION' | 'PAIEMENT';
export declare function estJourOuvrable(date: Date, nature?: NatureEcheance): boolean;
export declare function reporterAuJourOuvrable(echeance: Date, nature?: NatureEcheance): Date;
export declare function echeanceDeReversement(jours: number, annee: number, moisZeroBase: number, echeanceFiscale?: boolean): Date;
export declare const RESERVE_ECHEANCES_SOCIALES: string;
export declare const RESERVE_JOUR_OUVRABLE: string;
