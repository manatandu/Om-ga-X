export interface FicheTiers {
    id: string;
    code: string;
    type: string;
    adresse: string | null;
    boitePostale: string | null;
    ville: string | null;
    pays: string | null;
    telephone: string | null;
    email: string | null;
    numeroImpot: string | null;
    contact: string | null;
    qualite?: string | null;
    modeleImpressionExtraitId?: string | null;
    modeleImpressionReglementId?: string | null;
    modeleImpressionRappelId?: string | null;
}
export declare function motifRefusFusionTiers(source: FicheTiers, cible: FicheTiers): string | null;
declare const COORDONNEES: readonly ["adresse", "boitePostale", "ville", "pays", "telephone", "email", "numeroImpot", "contact", "qualite", "modeleImpressionExtraitId", "modeleImpressionReglementId", "modeleImpressionRappelId"];
export declare function coordonneesAComblement(source: FicheTiers, cible: FicheTiers): Partial<Record<(typeof COORDONNEES)[number], string>>;
export {};
