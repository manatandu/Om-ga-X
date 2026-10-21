import { FormeJuridiqueSyscohada, Referentiel } from '@prisma/client';
import { NatureEcheance } from './jour-ouvrable';
export interface NatureRetenue {
    cle: string;
    libelle: string;
    comptes: string[];
    exclusions?: string[];
    beneficiaire: 'ETAT' | 'PROVINCE' | 'ORGANISME_SOCIAL';
    contenu?: string;
    sourceDonnees?: string;
    joursApresPeriode: number;
    echeance: string;
    baseLegale: string;
    reserve?: string;
    imprime?: string;
    reserveSyscohada?: string;
    chargeSousConditionArticle20?: string;
    porteLInppTrimestriel?: true;
}
export interface ObligationDeclarative {
    cle: string;
    libelle: string;
    periodicite: 'MENSUELLE' | 'TRIMESTRIELLE' | 'ANNUELLE';
    joursApresPeriode?: number;
    moisEcheance?: number;
    jourEcheance?: number;
    echeance: string;
    baseLegale: string;
    contenu: string;
    sanction?: string;
    sourceDonnees?: string;
    echeanceFiscale?: boolean;
    natureEcheance?: NatureEcheance;
    personnesPhysiquesSeulement?: boolean;
    reserveRegimePhysique?: string;
    referentiels?: Referentiel[];
    formesExclues?: FormeJuridiqueSyscohada[];
    formesIncluses?: FormeJuridiqueSyscohada[];
    reserveFormesIncluses?: string;
    reserveCommune?: string;
    reserveSycebnl?: string;
    masqueeSiAucuneVente?: boolean;
}
export interface FaitsDuDossier {
    venteBiensServices?: boolean | null;
}
export declare const DERNIERE_VERIFICATION = "2026-08-29";
export declare function compteRelevantDe(numero: string, nature: Pick<NatureRetenue, 'comptes' | 'exclusions'>): boolean;
export declare const BORNE_IRPP_SALAIRES: string;
export declare const BORNE_CAPITAUX_MOBILIERS: string;
export declare const BORNE_PLUS_VALUES: string;
export declare const BORNE_PRESTATAIRES_NON_RESIDENTS: string;
export declare const NATURES_RETENUES: NatureRetenue[];
export declare const FORMES_PERSONNES_PHYSIQUES: FormeJuridiqueSyscohada[];
export declare const OBLIGATIONS_DECLARATIVES: ObligationDeclarative[];
export declare const AVERTISSEMENT_REGISTRE: string;
export declare function estEcheanceFiscale(e: NatureRetenue | ObligationDeclarative): boolean;
export declare function avertissementRegimeImpot(referentiel: Referentiel, formeJuridique?: FormeJuridiqueSyscohada | null): string;
export type ObligationServie = ObligationDeclarative & {
    reserve: string | null;
};
export declare function obligationsDeclarativesApplicables(referentiel: Referentiel, formeSyscohada?: FormeJuridiqueSyscohada | null, faits?: FaitsDuDossier): ObligationServie[];
export declare function reservePourReferentiel(nature: NatureRetenue, referentiel: Referentiel): string | undefined;
export declare const AVERTISSEMENT_REDEVABLE: string;
export declare const AVERTISSEMENT_REVERSEMENT_EXERCICE_SUIVANT: string;
export declare const AVERTISSEMENT_REVERSEMENT_ANTERIEUR: string;
export interface SignalementDeductibilite {
    cle: string;
    libelle: string;
    charge: string;
    montantEchuNonReverse: number;
    derniereEcheanceEchue: Date;
}
export declare function avertissementDeductibiliteArticle20(referentiel: Referentiel, signalements: SignalementDeductibilite[]): string | null;
