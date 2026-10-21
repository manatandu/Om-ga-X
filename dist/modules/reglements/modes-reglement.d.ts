import { NatureModeReglement } from '@prisma/client';
export declare const NATURES_ADMISES_ART_59_BIS: ReadonlySet<NatureModeReglement>;
export declare const SEUIL_ART_59_BIS = 1000000;
export declare const ENTREE_EN_VIGUEUR_ART_59_BIS: Date;
export declare const PLAFOND_MODES_REGLEMENT = 30;
export declare const LIBELLES_NATURES: Readonly<Record<NatureModeReglement, string>>;
export declare const MODES_USUELS: ReadonlyArray<{
    code: string;
    intitule: string;
    nature: NatureModeReglement;
}>;
export declare function motifRefusIdentiteMode(code: string, intitule: string): string | null;
export declare function natureLueSurLeCompte(numeroTresorerie: string | null): NatureModeReglement | null;
export declare function avertissementArt59Bis(p: {
    sens: 'FOURNISSEUR' | 'CLIENT';
    date: Date;
    dossierAssujetti: boolean | null;
    nature: NatureModeReglement | null;
    source: 'MODE' | 'COMPTE';
    compte: string;
    factures: ReadonlyArray<{
        reference: string;
        montant: number;
    }>;
    sousCondition?: ReadonlyArray<{
        reference: string;
        montant: number;
    }>;
    nonJugees?: ReadonlyArray<{
        reference: string;
        montant: number;
    }>;
}): string | null;
