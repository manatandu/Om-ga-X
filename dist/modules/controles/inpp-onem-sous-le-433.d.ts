import type { AnomalieControle } from './controles.service';
export declare const RACINES_ANCIENNES_INPP_ONEM: readonly ["4334", "4335"];
export declare const estCompteAncienInppOnem: (numero: string) => boolean;
export type CompteAncienInppOnem = {
    readonly numero: string;
    readonly intitule: string;
    readonly estActif: boolean;
    readonly lignesTotal: number;
    readonly lignesSaisiesExercice: number;
    readonly lignesReportExercice: number;
    readonly soldeCrediteurExercice: number;
};
export declare function anomalieInppOnemSousLe433(comptes: readonly CompteAncienInppOnem[], exerciceClos: boolean): AnomalieControle | null;
