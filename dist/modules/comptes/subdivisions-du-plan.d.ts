import { Referentiel, TypeCompteDetailTotal } from '@prisma/client';
export declare function estCompteSeme(referentiel: Referentiel, numero: string): boolean;
export declare function racineDuCompteSeme(referentiel: Referentiel, numero: string): string | null;
export declare function compteSemeSubdivise(referentiel: Referentiel, numero: string): string | null;
export declare function racinesSousLeCompteSeme(referentiel: Referentiel, numero: string): string[];
export declare function comptesDImputationSemes(referentiel: Referentiel, prefixe: string): string[];
export declare function sousComptePropose(referentiel: Referentiel, numeroSeme: string, longueur: number, existants: Iterable<string>): string | null;
export declare function numerosSemes(referentiel: Referentiel): string[];
export declare function estCompteDePassage(numero: string): boolean;
export declare function comptesDuPlanSubdivises(referentiel: Referentiel, comptes: readonly {
    numero: string;
    typeCompte: TypeCompteDetailTotal | string;
    estActif: boolean;
}[]): Set<string>;
