import type { Lecteur } from './reglements-de-tresorerie';
export type SuiteEnN = {
    decaisseEnN: number;
    engageEnN: number;
} | 'INCONNUE';
export interface DetteDeNMoins1 {
    id: string;
    compteId: string;
    numero: string;
    debit: unknown;
    credit: unknown;
    dateEcheance: Date | null;
    lettrageId: string | null;
    libelle: string;
}
export declare function resteDuALaDate(db: Lecteur, tenantId: string, ligne: {
    id: string;
    debit: unknown;
    credit: unknown;
    lettrageId: string | null;
}, date: Date): Promise<number | null>;
export declare function suiteEnNDesDettes(db: Lecteur, tenantId: string, precedent: {
    id: string;
    dateFin: Date;
}, exercice: {
    id: string;
    dateFin: Date;
}, dettes: DetteDeNMoins1[]): Promise<Map<string, SuiteEnN>>;
