import type { TypeTiers } from '@prisma/client';
export interface TiersADupliquer {
    code: string;
    type: TypeTiers;
    nom: string;
    qualite: string | null;
    adresse: string | null;
    boitePostale: string | null;
    ville: string | null;
    pays: string | null;
    telephone: string | null;
    email: string | null;
    contact: string | null;
    numeroImpot: string | null;
    celluleGroupeId: string | null;
    autoriseTvaDebits: boolean;
    horsRelance: boolean;
    validationAutomatiqueEcheances: boolean;
    modeleReglement: {
        id: string;
        estActif: boolean;
    } | null;
    modeReglement: {
        id: string;
        estActif: boolean;
    } | null;
    modeleImpressionExtraitId: string | null;
    modeleImpressionReglementId: string | null;
    modeleImpressionRappelId: string | null;
}
export interface CopieDuTiers {
    origine: string;
    corps: {
        type: TypeTiers;
        code: '';
        nom: string;
        qualite?: string;
        adresse?: string;
        boitePostale?: string;
        ville?: string;
        pays?: string;
        telephone?: string;
        email?: string;
        contact?: string;
        modeleReglementId?: string;
        modeReglementId?: string;
        validationAutomatiqueEcheances?: true;
        modeleImpressionExtraitId?: string;
        modeleImpressionReglementId?: string;
        modeleImpressionRappelId?: string;
    };
    nonRepris: Array<{
        champ: string;
        motif: string;
    }>;
}
export declare function copieDuTiers(t: TiersADupliquer, decomptes: {
    ribs: number;
    documents: number;
    lieux: number;
}): CopieDuTiers;
