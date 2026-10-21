import { NatureProvision, Referentiel } from '@prisma/client';
export interface CompteCourtTerme {
    compte: string;
    intitule: string;
    dotation: string;
    reprise: string;
}
export declare function comptesCourtTerme(referentiel: Referentiel): CompteCourtTerme[];
export declare function motifRefusCompteCourtTerme(referentiel: Referentiel, numero: string): string | null;
export declare function motifRefusCompteLongTerme(numero: string): string | null;
export declare function motifRefusHorizon(courtTerme: boolean, echeance: Date | null, finExercice: Date): string | null;
export declare function horizonAJuger(statut: string, montantCloture: number): boolean;
export declare function avertissementHorizon(courtTerme: boolean, echeance: Date | null, finExercice: Date): string | null;
export interface ConditionPropre {
    cle: string;
    libelle: string;
    source: string;
}
export declare const CONDITIONS_PROPRES: Partial<Record<NatureProvision, ConditionPropre[]>>;
export declare function clesInconnues(nature: NatureProvision, conditions: Record<string, boolean> | null | undefined): string[];
export declare function conditionsPropresManquantes(nature: NatureProvision, conditions: Record<string, boolean> | null | undefined): string[];
