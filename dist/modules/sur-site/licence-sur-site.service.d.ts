import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StatutLicenceSurSite, VerdictLicence } from './licence-signee';
export interface AccesPoste {
    identifiantSysteme: () => string | null;
    lire: (chemin: string) => string | null;
    ecrire: (chemin: string, contenu: string) => void;
    aujourdhui: () => string;
}
export declare const ACCES_POSTE_PAR_DEFAUT: AccesPoste;
export interface EtatSurSite extends VerdictLicence {
    surSite: boolean;
    empreinte: string | null;
    dateVersion: string | null;
}
export declare class LicenceSurSiteService implements OnModuleInit, OnModuleDestroy {
    private readonly acces;
    private readonly clePublique;
    private readonly dossierVersion;
    private readonly log;
    private etatCourant;
    private minuterie;
    readonly surSite: boolean;
    readonly dossierDonnees: string;
    constructor(acces?: AccesPoste, env?: NodeJS.ProcessEnv, clePublique?: string | null, dossierVersion?: string);
    onModuleInit(): void;
    onModuleDestroy(): void;
    get cheminLicence(): string;
    private get cheminHorloge();
    private dateVersion;
    private horlogeMax;
    private verifier;
    actualiser(): EtatSurSite;
    etat(): EtatSurSite;
    motifRefusMigration(): string | null;
    autorisation(): {
        autorise: boolean;
        motif?: string;
    };
    deposer(texte: string): EtatSurSite;
    verifierPlafondDossiers(nombreActuel: number): void;
}
export type { StatutLicenceSurSite };
