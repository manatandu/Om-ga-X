import type { NatureModeleImpression, TypeRelance } from '@prisma/client';
export declare const JETON_DOCUMENT = "{document}";
export declare const JETONS_MODELE_IMPRESSION: ReadonlyArray<{
    jeton: string;
    sens: string;
}>;
export declare const LONGUEUR_INTITULE_MODELE = 35;
export declare const LONGUEUR_TEXTE_MODELE = 4000;
export declare const PLAFOND_MODELES_IMPRESSION = 100;
export declare const LIBELLES_NATURE_MODELE: Readonly<Record<NatureModeleImpression, string>>;
export declare function natureDuNiveau(type: TypeRelance): NatureModeleImpression;
export declare const COLONNE_DU_TIERS: Readonly<Record<NatureModeleImpression, 'modeleImpressionExtraitId' | 'modeleImpressionReglementId' | 'modeleImpressionRappelId'>>;
export declare function intituleDuModele(brut: string): string;
export declare function motifRefusIntituleModele(intitule: string, autres: ReadonlyArray<{
    id: string;
    intitule: string;
}>, idModifie: string | null): string | null;
export declare function motifRefusTexteModele(texte: string): string | null;
export interface IdentiteDuTiers {
    nom: string;
    code: string;
    qualite: string | null;
    contact: string | null;
    adresse: string | null;
    boitePostale: string | null;
    ville: string | null;
    pays: string | null;
}
export declare function adresseDuTiers(t: Pick<IdentiteDuTiers, 'adresse' | 'boitePostale' | 'ville' | 'pays'>): string;
export declare function jourImprime(jour: Date): string;
export interface Cadre {
    modele: string | null;
    avant: string;
    apres: string;
}
export declare function cadreDuModele(modele: {
    intitule: string | null;
    texte: string;
}, tiers: IdentiteDuTiers, contexte: {
    entite: string;
    jour: Date;
}): Cadre;
export declare function habiller(cadre: Cadre | null, document: string): string;
export declare function motifRefusAttribution(attendue: NatureModeleImpression, modele: {
    intitule: string;
    nature: NatureModeleImpression;
}): string | null;
