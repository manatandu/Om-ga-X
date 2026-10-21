export interface ActeurAudit {
    acteurId?: string;
    acteurEmail: string;
    tenantId?: string;
    adresseIp?: string;
    journauxAutorises?: readonly string[] | null;
}
export type ClientTransactionAudit = unknown;
export declare function journaliserDansTransaction<T>(tx: ClientTransactionAudit, suite: () => T): T;
export declare function transactionAuditee(): ClientTransactionAudit | undefined;
export declare function dansContexteAudit<T>(acteur: ActeurAudit, suite: () => T): T;
export declare function acteurCourant(): ActeurAudit | undefined;
export declare const ACTEUR_SYSTEME = "systeme@omegax";
