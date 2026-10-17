export declare function valeurActualiseeDemantelement(coutFutur: number, tauxPourcent: number, annees: number): number;
export interface ParametresDemantelement {
    estComposantDemantelement: boolean;
    coutFutur: number | null;
    tauxPourcent: number | null;
    valeurOrigine: number;
}
export declare function motifRefusParametresDemantelement(p: ParametresDemantelement): string | null;
export declare function moisDeDesactualisation(exercice: {
    dateDebut: Date;
    dateFin: Date;
}, dateEntree: Date, arreteAu?: Date): number;
export declare function resteADesactualiser(p: {
    tauxPourcent: number | null;
    provision: number;
    coutFutur: number | null;
}): boolean;
export declare function desactualisationExercice(p: {
    provisionOuverture: number;
    tauxPourcent: number;
    mois: number;
    coutFutur: number | null;
}): number;
export interface EtatDesactualisation {
    estComposantDemantelement: boolean;
    refusSystemeMinimal?: string | null;
    repris?: boolean;
    entreParLaProvision: boolean;
    tauxPourcent: number | null;
    exerciceOuvert: boolean;
    dejaPassee: boolean;
    repriseFaite: boolean;
    enService: boolean;
    mois: number;
    exercicesManquants: string[];
}
export declare function motifRefusDesactualisation(e: EtatDesactualisation): string | null;
export declare function ventilationReprise(provisionInitiale: number, desactualisations: readonly number[]): {
    exploitation: number;
    financiere: number;
    total: number;
};
export declare function motifRefusReprise(e: {
    estComposantDemantelement: boolean;
    entreParLaProvision: boolean;
    exerciceOuvert: boolean;
    repriseFaite: boolean;
    dateDansExercice: boolean;
    repris?: boolean;
    exercicesManquants?: string[];
    desactualiseeJusquAu?: string | null;
}): string | null;
