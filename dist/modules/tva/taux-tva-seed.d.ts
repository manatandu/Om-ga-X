import { Referentiel } from '@prisma/client';
type TauxSeed = {
    code: string;
    intitule: string;
    taux: number;
    numeroCompteCollecte?: string;
    numeroCompteDeductible?: string;
};
export declare function tauxTvaDefaut(referentiel: Referentiel): TauxSeed[];
export {};
