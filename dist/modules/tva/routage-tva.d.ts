export declare const COMPTES_DE_TAXE_ROUTES_SYSCOHADA: readonly string[];
export declare function compteTvaCollectee(numeroProduit: string): string | null;
export declare function compteTvaRecuperable(numeroCharge: string): string | null;
export declare function compteTvaPourContrepartie(referentiel: string | undefined, sens: 'recette' | 'depense', numeroContrepartie: string, numerosDuPlan: ReadonlySet<string>): string | null;
export declare function estTauxZero(taux: number | string): boolean;
