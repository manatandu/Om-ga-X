import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare function parametresConnexion(url: string | undefined): Record<string, string> | null;
export declare function nomSauvegarde(d: Date): string;
export declare function copiesARetirer(noms: string[], garder: number, motif?: RegExp): string[];
export declare function copiesEnClairARetirer(noms: string[]): string[];
export interface EtatCopieExterne {
    dossier: string | null;
    derniere: string | null;
    le: string | null;
    erreur: string | null;
    chiffree: boolean;
}
export interface CopieSauvegarde {
    nom: string;
    taille: number;
    date: string;
}
export declare class SauvegardeSurSiteService implements OnModuleInit, OnModuleDestroy {
    private readonly env;
    private readonly log;
    private enCours;
    private minuterie;
    readonly surSite: boolean;
    readonly dossier: string;
    private readonly garder;
    private readonly garderAvantMiseAJour;
    private readonly pgDump;
    private readonly fichierCopieExterne;
    private readonly fichierRepere;
    constructor(env?: NodeJS.ProcessEnv);
    onModuleInit(): void;
    onModuleDestroy(): void;
    lister(): CopieSauvegarde[];
    private copies;
    siNecessaire(maintenant?: Date): Promise<CopieSauvegarde | null>;
    lancer(): Promise<CopieSauvegarde>;
    private executer;
    private copiesAvantMiseAJourProtegees;
    copieExterne(): EtatCopieExterne;
    private reglageExterne;
    private noterCopieExterne;
    definirCopieExterne(dossier: string | null, phrase?: string | null): Promise<EtatCopieExterne>;
    recopierSiAbsente(): Promise<void>;
    recopier(nom: string): Promise<void>;
}
