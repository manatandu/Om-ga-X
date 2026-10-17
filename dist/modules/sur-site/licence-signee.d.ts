export declare const FORMAT_LICENCE = 1;
export interface ContenuLicence {
    format: number;
    numero: string;
    titulaire: string;
    empreinteMachine: string;
    emiseLe: string;
    finMaintenance: string;
    expiration: string | null;
    dossiersMax: number;
}
export interface FichierLicence {
    contenu: ContenuLicence;
    signature: string;
}
export type StatutLicenceSurSite = 'CLE_EDITEUR_ABSENTE' | 'ABSENTE' | 'ILLISIBLE' | 'SIGNATURE_INVALIDE' | 'AUTRE_MACHINE' | 'HORLOGE_RECULEE' | 'EXPIREE' | 'VERSION_INCONNUE' | 'VERSION_NON_COUVERTE' | 'VALIDE';
export interface VerdictLicence {
    statut: StatutLicenceSurSite;
    motif: string | null;
    contenu: ContenuLicence | null;
}
export declare function serialiser(c: ContenuLicence): string;
export declare function motifRefusContenu(c: Partial<ContenuLicence> | null | undefined): string | null;
export declare function signerLicence(contenu: ContenuLicence, clePriveePem: string): FichierLicence;
export declare function empreinteDe(identifiantSysteme: string): string;
export interface ContexteVerification {
    clePubliquePem: string | null;
    empreinte: string;
    aujourdhui: string;
    horlogeMax: string | null;
    dateVersion: string | null;
}
export declare function verifierLicence(texte: string | null, ctx: ContexteVerification): VerdictLicence;
export declare function versionCouverte(c: ContenuLicence, dateVersion: string | null): boolean;
export declare function motifRefusMigration(v: VerdictLicence, dateVersion: string | null): string | null;
