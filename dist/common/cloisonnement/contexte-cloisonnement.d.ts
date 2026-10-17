export declare function horsCloisonnement<T>(raison: string, suite: () => T): T;
export declare function perimetreDeGroupe<T>(dossiers: Iterable<string>, suite: () => T): T;
export declare function raisonHorsCloisonnement(): string | undefined;
export declare function perimetreCourant(): ReadonlySet<string> | undefined;
export declare class CloisonnementViole extends Error {
    constructor(message: string);
}
