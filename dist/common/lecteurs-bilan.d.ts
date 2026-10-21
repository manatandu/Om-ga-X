export declare const LECTEUR_BILAN_SYSCOHADA_NORMAL = "LECTEUR_BILAN_SYSCOHADA_NORMAL";
export declare const LECTEUR_BILAN_SYSCOHADA_SMT = "LECTEUR_BILAN_SYSCOHADA_SMT";
export declare const LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS = "LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS";
export declare const LECTEUR_BILAN_SYCEBNL_PROJETS = "LECTEUR_BILAN_SYCEBNL_PROJETS";
export declare const LECTEUR_BILAN_SYCEBNL_SMT = "LECTEUR_BILAN_SYCEBNL_SMT";
export interface BilanLuParLaCloture {
    totalActif: number;
    totalPassif: number;
    controle?: {
        resultatClasses678: number;
        resultatCompte13: number;
    } | null;
}
export interface LecteurBilan {
    bilan(tenantId: string, exerciceId: string): Promise<BilanLuParLaCloture>;
}
export declare const LECTEUR_VIREMENTS_GROUPE = "LECTEUR_VIREMENTS_GROUPE";
export interface LecteurVirementsGroupe {
    virements585DuGroupe(tenantId: string, dateArrete: Date): Promise<{
        solde: number;
    }>;
}
