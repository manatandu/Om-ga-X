import { Referentiel } from '@prisma/client';
export declare const FAMILLES_TIERS: readonly ["FOURNISSEURS", "CLIENTS", "SALARIES", "AUTRES"];
export type FamilleTiers = (typeof FAMILLES_TIERS)[number];
export declare function divisionnaireDeLaFamille(famille: Exclude<FamilleTiers, 'AUTRES'>): string;
export declare function estFamilleTiers(v: unknown): v is FamilleTiers;
export declare function compteDeLaFamille(famille: FamilleTiers, numero: string, rattache: boolean): boolean;
export declare function sousTitreFamille(famille: FamilleTiers, referentiel: Referentiel): string;
