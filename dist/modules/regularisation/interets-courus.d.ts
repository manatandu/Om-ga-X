import { Referentiel } from '@prisma/client';
export declare function compteInteretsCourus(referentiel: Referentiel, numeroEmprunt: string): {
    racine: string;
} | {
    refus: string;
};
export declare const CHARGES_INTERETS_ADMISES: readonly ["6711", "6712", "6741", "6742", "6748"];
export declare function motifRefusChargeInterets(numeroCharge: string): string | null;
export declare function chargeInteretsProposee(referentiel: Referentiel, numeroEmprunt: string): string | null;
