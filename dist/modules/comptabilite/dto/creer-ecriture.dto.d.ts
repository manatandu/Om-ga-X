import { MotifImputationOuverture } from '@prisma/client';
export declare class VentilationLigneDto {
    sectionId: string;
    debit?: number;
    credit?: number;
}
export declare class LigneEcritureDto {
    compteId: string;
    libelle?: string;
    debit?: number;
    credit?: number;
    tauxTvaId?: string;
    dateEcheance?: string;
    dateVersement?: string;
    ventilations?: VentilationLigneDto[];
    deviseId?: string;
    montantDevise?: number;
    coursApplique?: number;
    modeReglementId?: string;
}
export declare class CreerEcritureDto {
    exerciceId: string;
    journalId: string;
    date: string;
    libelle: string;
    reference?: string;
    lignes: LigneEcritureDto[];
    reporterAuPremierJourOuvert?: boolean;
    confirmerComptesEnSommeil?: boolean;
}
export declare class ImputationOuvertureDto {
    exerciceId: string;
    journalId: string;
    motif: MotifImputationOuverture;
    justification: string;
    compteReportANouveauId: string;
    compteContrepartieId: string;
    montant: number;
}
