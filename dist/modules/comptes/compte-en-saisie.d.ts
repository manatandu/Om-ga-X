import { Referentiel, TypeCompteDetailTotal } from '@prisma/client';
export declare const MOTIF_OPTION_FERMEE: string;
export declare function collectifDeTiers(referentiel: Referentiel, numeroDuPlan: string): string | null;
export interface CompteDuPlanLu {
    numero: string;
    intitule: string;
    typeCompte: TypeCompteDetailTotal;
    estActif: boolean;
}
export declare function motifRefusCompteEnSaisie(p: {
    referentiel: Referentiel;
    numero: string;
    longueurCompte: number;
    existe: boolean;
    numeroDuPlan: string | null;
    compteDuPlan: CompteDuPlanLu | null;
}): string | null;
