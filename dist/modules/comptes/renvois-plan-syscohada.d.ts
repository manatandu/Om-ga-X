export declare const RENVOIS_PLAN_SYSCOHADA: Record<number, string>;
export interface RenvoiDuCompte {
    numero: string;
    renvoi: number;
    texte: string;
}
export declare function renvoisDuPlanSyscohada(): RenvoiDuCompte[];
