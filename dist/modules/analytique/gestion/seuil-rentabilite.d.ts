import { type Comportement } from './comportement-gestion';
export interface MouvementDeGestion {
    numero: string;
    intitule: string;
    classe: string;
    mouvementDebit: number;
    mouvementCredit: number;
    comportement: Comportement | null;
    partVariablePct: number | null;
}
export interface SeuilDeRentabilite {
    produits: number;
    chargesVariables: number;
    chargesFixes: number;
    marge: number;
    tauxMarge: number | null;
    seuil: number | null;
    margeSecurite: number | null;
    indiceSecurite: number | null;
    pointMortMois: number | null;
    motif: string | null;
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
export declare function seuilDeRentabilite(mouvements: readonly MouvementDeGestion[], moisExercice: number): SeuilDeRentabilite;
