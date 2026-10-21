import { NatureLocationAcquisition, Referentiel } from '@prisma/client';
export interface ComptesLocationAcquisition {
    dette: string;
    interetsCourus: string;
    interets: string;
    redevances: string;
}
export declare const COMPTES_LOCATION_ACQUISITION: Record<Referentiel, Partial<Record<NatureLocationAcquisition, ComptesLocationAcquisition>>>;
export declare const BIENS_IMMOBILIERS_LOCATION_ACQUISITION: readonly ["2286", "2316", "2326"];
export declare const BIENS_MOBILIERS_LOCATION_ACQUISITION: readonly ["2416", "2426", "2446", "2456"];
export declare function estCompteDeLocationAcquisition(numero: string): boolean;
export declare function motifRefusNatureEtCompte(referentiel: Referentiel, nature: NatureLocationAcquisition, numeroBien: string): string | null;
