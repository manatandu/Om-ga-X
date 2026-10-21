import { StatutMessage } from '@prisma/client';
export declare const PLAFOND_TENTATIVES = 5;
export declare const ATTENTES_MINUTES: number[];
export declare function attenteApresEchec(tentatives: number): number | null;
export declare function prochainEssaiApresEchec(tentatives: number, maintenant: Date): Date | null;
export declare function statutApresEchec(tentatives: number): StatutMessage;
