export declare enum TypeImport {
    PLAN_COMPTES = "PLAN_COMPTES",
    BALANCE = "BALANCE",
    ECRITURES = "ECRITURES"
}
export declare class AnalyserImportDto {
    type: TypeImport;
    nomFichier: string;
    contenuBase64: string;
}
export declare class ExecuterImportDto extends AnalyserImportDto {
    mapping: Record<string, string>;
    exerciceId?: string;
    journalId?: string;
    dateOperation?: string;
    creerComptesManquants?: boolean;
    bilanDOuverture?: boolean;
    simulation?: boolean;
    separateur?: string;
}
