import { RegimeTelemetrie } from './nettoyage-telemetrie';
export interface SdkSentry {
    init(options: object): unknown;
    captureException(erreur: unknown, contexte?: {
        tags?: Record<string, string>;
    }): unknown;
    onUncaughtExceptionIntegration(): unknown;
    onUnhandledRejectionIntegration(options: {
        mode: 'strict' | 'warn' | 'none';
    }): unknown;
    linkedErrorsIntegration(): unknown;
    dedupeIntegration(): unknown;
}
export declare function optionsSentryServeur(dsn: string, revision: string | undefined, sdk: SdkSentry): {
    dsn: string;
    environment: string;
    release: string | undefined;
    defaultIntegrations: false;
    integrations: unknown[];
    dataCollection: {
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
    sendClientReports: boolean;
    initialScope: {
        tags: {
            cote: string;
        };
    };
    beforeSend: <T>(evenement: T) => T | null;
    beforeBreadcrumb: <T>(miette: T) => T | null;
};
export declare function demarrerTelemetrieServeur(env?: NodeJS.ProcessEnv, charger?: () => SdkSentry): RegimeTelemetrie;
export declare function signalerPanneServeur(erreur: unknown, etiquettes: Record<string, string | undefined>): void;
