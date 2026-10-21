export declare const LIENS_QUI_NE_RETIENNENT_PAS: string[];
export declare function comptesUtilises(prisma: unknown, tenantId: string, ids: string[]): Promise<Set<string>>;
export declare function estPropose(c: {
    id: string;
    estRetenu: boolean;
}, utilises: Set<string>): boolean;
export declare function comptesProposes<C extends {
    id: string;
    estRetenu: boolean;
}>(prisma: unknown, tenantId: string, comptes: C[]): Promise<{
    proposes: C[];
    ecartes: number;
}>;
export declare function comptesNonPersonnalises(prisma: unknown, tenantId: string, ids: string[]): Promise<{
    id: string;
    numero: string;
    intitule: string;
}[]>;
export declare function motifComptesNonPersonnalises(comptes: {
    numero: string;
    intitule: string;
}[], geste: string): string | null;
export { LISTES_DE_COMPTES, PARAMETRE_RETENUS, ROUTES_QUI_NE_SONT_PAS_DES_LISTES, type RegimeListeDeComptes, } from './listes-de-comptes';
