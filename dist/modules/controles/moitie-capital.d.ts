import { FormeJuridiqueSyscohada } from '@prisma/client';
export interface VerdictMoitieCapital {
    capitauxPropres: number;
    capital: number;
    consequence: string;
    action: string;
}
export type RegimeMoitieCapital = 'SARL' | 'SA' | 'SAS';
export declare function regimeMoitieCapital(forme: FormeJuridiqueSyscohada | null | undefined): RegimeMoitieCapital | null;
export declare function formesDuRegimeMoitieCapital(regimes: RegimeMoitieCapital[]): FormeJuridiqueSyscohada[];
export declare function verdictMoitieCapital(forme: FormeJuridiqueSyscohada | null, totalCapitauxPropresBilan: number, capitalNonAppele: number, capitalNominal: number): VerdictMoitieCapital | null;
