import { type VersionsDuDossier } from './cotisations-paie';
import { type Annexe } from './bareme-smig';
export type NomBareme = 'CNSS' | 'INPP' | 'ONEM' | 'SMIG';
export declare const BAREMES_SERVIS: readonly NomBareme[];
export declare const MOTIF_BAREME_NON_SAISISSABLE: string;
export declare const DERNIERE_DATE_LIVREE: Record<NomBareme, string>;
export type VersionSaisie = {
    bareme: string;
    aPartirDu: string;
    reference: string;
    valeurs: unknown;
};
export declare function lireValeurs(bareme: NomBareme, valeurs: unknown): {
    ok: true;
    valeurs: Record<string, unknown>;
} | {
    ok: false;
    motif: string;
};
export declare function motifRefusVersion(saisie: VersionSaisie, datesDuDossier: readonly string[]): string | null;
export type LigneVersion = {
    bareme: string;
    aPartirDu: string;
    reference: string;
    valeurs: unknown;
};
export declare function versionsDuDossier(lignes: readonly LigneVersion[]): VersionsDuDossier;
export declare function annexesSmigDuDossier(lignes: readonly LigneVersion[]): Annexe[];
export declare function moisCouverts(aPartirDu: string, suivante: string | null): {
    depuis: string;
    avant: string | null;
};
export declare function versionsLivrees(): {
    CNSS: {
        aPartirDu: string | null;
        reference: string;
        valeurs: Record<string, unknown>;
    }[];
    SMIG: {
        aPartirDu: string | null;
        reference: string;
        valeurs: Record<string, unknown>;
    }[];
    INPP: {
        aPartirDu: string | null;
        reference: string;
        valeurs: Record<string, unknown>;
    }[];
    ONEM: {
        aPartirDu: string | null;
        reference: string;
        valeurs: Record<string, unknown>;
    }[];
};
