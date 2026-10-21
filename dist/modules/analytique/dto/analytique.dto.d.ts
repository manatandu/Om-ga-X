import { TypeCompteDetailTotal } from '@prisma/client';
export declare class CreerPlanAnalytiqueDto {
    code: string;
    intitule: string;
    classesVentilees?: string;
    ventilationObligatoire?: boolean;
    gererBudgets?: boolean;
    ordre?: number;
    longueurSections?: number | null;
}
export declare class ModifierPlanAnalytiqueDto {
    intitule?: string;
    classesVentilees?: string;
    ventilationObligatoire?: boolean;
    gererBudgets?: boolean;
    estActif?: boolean;
    longueurSections?: number | null;
}
export declare class CreerSectionDto {
    code: string;
    intitule: string;
    type?: TypeCompteDetailTotal;
    bailleurId?: string;
    dateDebut?: string;
    dateFin?: string;
}
export declare class ModifierSectionDto {
    intitule?: string;
    bailleurId?: string | null;
    dateDebut?: string | null;
    dateFin?: string | null;
    estActive?: boolean;
}
export declare class DoterBudgetDto {
    exerciceId: string;
    montantAnnuel: number;
}
export declare class ModifierBudgetMoisDto {
    exerciceId: string;
    mois: number;
    montant: number;
}
export declare class LigneVentilationDto {
    sectionId: string;
    debit?: number;
    credit?: number;
}
export declare class VentilerLigneDto {
    ventilations: LigneVentilationDto[];
}
