export declare const LOT_LECTURE = 5000;
export declare const LOT_ECRITURES = 500;
export declare function lireParLots<T extends {
    id: string;
}>(charger: (curseur: string | undefined) => Promise<T[]>, traiter: (element: T) => void, taille?: number): Promise<void>;
export declare function pageApres(curseur: string | undefined, taille: number): {
    cursor?: {
        id: string;
    } | undefined;
    skip?: number | undefined;
    orderBy: {
        id: "asc";
    };
    take: number;
};
export declare function idApres(curseur: string | undefined): {
    id?: {
        gt: string;
    };
};
export interface CleDePage<C extends string = string> {
    champ: C;
    valeur: string | number | Date | null;
    nullable?: boolean;
}
export declare function apresLaCle<W extends {
    id?: unknown;
} = Record<string, unknown>>(cles: readonly [...CleDePage<Extract<keyof NoInfer<W>, string>>[], CleDePage<'id'>]): {
    OR: W[];
};
export declare class Collecte<T> {
    private readonly plafond;
    readonly elements: T[];
    nombre: number;
    constructor(plafond: number);
    ajouter(element: T): void;
    get tronquee(): boolean;
}
export declare class PremiersSelon<T> {
    private readonly capacite;
    private readonly ordre;
    private tas;
    nombre: number;
    constructor(capacite: number, ordre: (a: T, b: T) => number);
    ajouter(element: T): void;
    private retailler;
    elements(): T[];
    get tronquee(): boolean;
}
