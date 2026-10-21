import { ConditionEcheance, TypeEcheance, TypeJournal } from '@prisma/client';
export declare class CreerModeleReglementDto {
    intitule: string;
    delaiJours: number;
    echeance?: ConditionEcheance;
    modeReglementId?: string;
}
export declare class ModifierModeleReglementDto {
    intitule?: string;
    delaiJours?: number;
    echeance?: ConditionEcheance;
    estActif?: boolean;
    modeReglementId?: string | null;
}
export declare class CreerEcheanceReglementDto {
    ordre: number;
    type: TypeEcheance;
    valeur?: number;
    delaiJours: number;
    echeance?: ConditionEcheance;
    modeReglementId?: string;
}
export declare class CalculerEcheancesDto {
    dateFacture: string;
    montantTotal: number;
}
export declare class EcheancierDeLigneDto {
    date: string;
    montant: number;
    sens: 'DEBIT' | 'CREDIT';
    typeJournal?: TypeJournal;
}
