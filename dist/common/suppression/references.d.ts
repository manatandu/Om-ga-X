export interface Reference {
    modele: string;
    champ: string;
    nombre: number;
}
export declare function referencesVers(prisma: unknown, cible: string, id: string | string[], tenantId: string, exclure?: string[]): Promise<Reference[]>;
export declare function libelleReference(r: Reference): string;
export declare function refuserSiReferences(objet: string, refs: Reference[]): void;
export declare function reporterReferences(prisma: unknown, cible: string, sourceId: string, cibleId: string, tenantId: string): Promise<Reference[]>;
export declare function identifiantsUtilises(prisma: unknown, cible: string, ids: string[], tenantId: string, exclure?: string[]): Promise<Set<string>>;
