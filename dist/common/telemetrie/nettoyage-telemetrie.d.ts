export declare const HOTES_TELEMETRIE_UE: readonly ["https://*.ingest.de.sentry.io", "https://eu.i.posthog.com"];
export declare const HOTE_POSTHOG_UE = "https://eu.i.posthog.com";
export type RegimeTelemetrie = {
    actif: true;
} | {
    actif: false;
    motif: 'aucune-cle' | 'sur-site' | 'hors-ue' | 'echec';
};
export declare function regimeSentry(dsn: string | undefined | null, surSite: boolean): RegimeTelemetrie;
export declare function regimePosthog(cle: string | undefined | null, surSite: boolean): RegimeTelemetrie;
export declare function messageRegime(service: 'Sentry' | 'PostHog', regime: RegimeTelemetrie): string;
export declare function normaliserChemin(chemin: string): string;
export declare function nettoyerUrl(url: string): string;
export declare function nettoyerMessage(texte: unknown): string;
export interface ContexteNettoyage {
    route?: string;
}
export declare function nettoyerEvenementSentry<T>(evenement: T, contexte?: ContexteNettoyage): T | null;
export declare function typeAuMessageLisible(type: unknown): boolean;
export declare function nettoyerMietteSentry<T>(miette: T): T | null;
export declare function nettoyerEvenementPosthog<T>(evenement: T): T | null;
export declare const COLLECTE_SENTRY_COUPEE: {
    userInfo: boolean;
    cookies: boolean;
    httpHeaders: boolean;
    httpBodies: never[];
    urlQueryParams: boolean;
    graphQL: {
        document: boolean;
        variables: boolean;
    };
    genAI: {
        inputs: boolean;
        outputs: boolean;
    };
    databaseQueryData: boolean;
    queues: boolean;
    stackFrameVariables: boolean;
    frameContextLines: number;
};
