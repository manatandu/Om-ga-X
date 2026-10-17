import { FormeJuridiqueEbnl } from '@prisma/client';
export type FondementExemptionIs = 'ART_5_POINT_3' | 'ART_5_POINT_5' | 'ART_5_POINT_3_OU_POINT_5' | 'HORS_LOI_004_2001' | 'INDETERMINE';
export type EntreeQualificationExemptionIs = {
    formeJuridique?: FormeJuridiqueEbnl | null;
    droitEtranger?: boolean | null;
    actePersonnaliteJuridique?: string | null;
    attestationExemptionIs?: string | null;
    dateAttestationExemptionIs?: Date | string | null;
};
export type QualificationExemptionIs = {
    fondement: FondementExemptionIs;
    enonce: string;
    attestationRequise: boolean | null;
    attestationConnue: boolean;
    dateAttestationConnue: boolean;
    exemptionAffirmable: boolean;
    avertissements: string[];
};
export declare function qualifierExemptionIs(entree: EntreeQualificationExemptionIs): QualificationExemptionIs;
