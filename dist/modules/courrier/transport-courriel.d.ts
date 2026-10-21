export interface ConfigurationSmtp {
    hote: string;
    port: number;
    securise: boolean;
    identifiant: string;
    motDePasse: string;
    expediteur: string;
}
export interface ManqueTransport {
    variable: string;
    raison: string;
}
export interface EtatTransport {
    configure: boolean;
    manques: ManqueTransport[];
    expediteur: string | null;
}
export interface EnvoiCourriel {
    destinataire: string;
    destinataireNom?: string | null;
    sujet: string;
    corps: string;
    pieceJointe?: {
        nom: string;
        texte: string;
    } | null;
}
export declare function manquesDuTransport(env: NodeJS.ProcessEnv): ManqueTransport[];
export declare function lireConfigurationSmtp(env: NodeJS.ProcessEnv): ConfigurationSmtp | null;
export declare function texteDErreur(erreur: unknown): string;
export declare class TransportAbsent extends Error {
    constructor(manques: ManqueTransport[]);
}
export declare class TransportCourriel {
    private transporteur;
    private signature;
    protected environnement(): NodeJS.ProcessEnv;
    etat(): EtatTransport;
    envoyer(envoi: EnvoiCourriel): Promise<void>;
    private transporteurPour;
}
