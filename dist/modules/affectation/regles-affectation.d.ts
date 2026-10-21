import { FormeJuridiqueSyscohada, Referentiel } from '@prisma/client';
export interface DestinationsDuSens {
    racines: string[];
    source: string;
}
export interface ReglesAffectation {
    destinationsBenefice: DestinationsDuSens;
    destinationsPerte: DestinationsDuSens;
    interdits: {
        racine: string;
        motif: string;
    }[];
    reserveLegale?: string;
    reportANouveau: string;
}
export declare const REGLES: Record<Referentiel, ReglesAffectation>;
export declare function destinationsDuSens(regles: ReglesAffectation, estBenefice: boolean): DestinationsDuSens;
export type RegimeReserveLegale = {
    exigee: true;
    source: string;
    capital: string;
} | {
    exigee: false;
    source: string;
    motif: string;
    capital: string | null;
};
export declare function regimeReserveLegale(forme: FormeJuridiqueSyscohada | null): RegimeReserveLegale;
export declare function racineCapital(referentiel: Referentiel, forme: FormeJuridiqueSyscohada | null): string | null;
export declare function dotationReserveLegale(params: {
    referentiel: Referentiel;
    forme: FormeJuridiqueSyscohada | null;
    benefice: number;
    pertesAnterieures: number;
    reserveExistante: number;
    capitalSocial: number;
}): {
    dotation: number | null;
    motif: string;
};
export declare function avertissementLigneCapital(forme: FormeJuridiqueSyscohada | null, estBenefice: boolean): string | null;
