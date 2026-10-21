export interface ContenuEmpreinte {
    rang: number;
    tenantId: string | null;
    horodatage: Date;
    acteurId: string | null;
    acteurEmail: string;
    adresseIp: string | null;
    action: string;
    entite: string;
    entiteId: string | null;
    avant: unknown;
    apres: unknown;
    empreintePrecedente: string;
}
export declare const EMPREINTE_ORIGINE = "origine";
export declare function calculerEmpreinte(contenu: ContenuEmpreinte): string;
