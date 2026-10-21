import { type Comportement } from './comportement-gestion';
export interface ChargeDeSection {
    compteId: string;
    numero: string;
    intitule: string;
    montant: number;
    comportement: Comportement | null;
    partVariablePct: number | null;
}
export interface DonneesDeclarees {
    capaciteNormale: number;
    activiteReelle: number;
    quantiteProduite: number | null;
}
export interface CoutDeProduction {
    chargesVariables: number;
    chargesFixes: number;
    coefficient: number;
    suractivite: boolean;
    chargesFixesImputees: number;
    sousActivite: number;
    coutProduction: number | null;
    coutUnitaire: number | null;
    horsCalcul: {
        numero: string;
        intitule: string;
        montant: number;
    }[];
    nonDeclares: {
        numero: string;
        intitule: string;
        montant: number;
    }[];
}
export declare function motifRefusDonnees(d: {
    capaciteNormale: number;
    activiteReelle: number;
    quantiteProduite: number | null;
    source: string;
    unite: string;
}): string | null;
export declare function coutDeProduction(charges: readonly ChargeDeSection[], d: DonneesDeclarees): CoutDeProduction;
