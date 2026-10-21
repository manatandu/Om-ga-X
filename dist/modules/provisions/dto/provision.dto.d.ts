import { NatureProvision, StatutProvision } from '@prisma/client';
export declare class CreerProvisionDto {
    objet: string;
    nature: NatureProvision;
    compteId?: string;
    statut?: StatutProvision;
    obligationExiste?: boolean;
    resulteEvenementPasse?: boolean;
    sortieProbable?: boolean;
    estimationFiable?: boolean;
    justificationObligation: string;
    echeanceAttendue?: string;
    incertitudes?: string;
    montantOuverture?: number;
    dotationsExercice?: number;
    montantsUtilises?: number;
    reprisesNonUtilisees?: number;
    effetActualisation?: number;
    remboursementAttendu?: number;
    remboursementCertain?: boolean;
    remboursementTiers?: string;
    motifNonComptabilisation?: string;
    courtTerme?: boolean;
    conditionsPropres?: Record<string, boolean>;
}
export declare class ModifierProvisionDto {
    objet?: string;
    nature?: NatureProvision;
    compteId?: string;
    statut?: StatutProvision;
    obligationExiste?: boolean;
    resulteEvenementPasse?: boolean;
    sortieProbable?: boolean;
    estimationFiable?: boolean;
    justificationObligation?: string;
    echeanceAttendue?: string;
    incertitudes?: string;
    montantOuverture?: number;
    dotationsExercice?: number;
    montantsUtilises?: number;
    reprisesNonUtilisees?: number;
    effetActualisation?: number;
    remboursementAttendu?: number;
    remboursementCertain?: boolean;
    remboursementTiers?: string;
    motifNonComptabilisation?: string;
    courtTerme?: boolean;
    conditionsPropres?: Record<string, boolean>;
}
export declare class StatuerProvisionDto {
    statut: StatutProvision;
    motifNonComptabilisation?: string;
}
export declare class ReporterProvisionsDto {
    exerciceSourceId: string;
    exerciceCibleId: string;
}
