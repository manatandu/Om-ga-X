export declare class TranscrireInventaireDto {
    exerciceId: string;
    resumeOperationInventaire?: string;
}
export declare class ResumeInventaireDto {
    resumeOperationInventaire: string;
}
export declare class EtablirRapportActiviteDto {
    exerciceId: string;
    etabliLe: string;
    situationExerciceEcoule?: string;
    perspectivesDeveloppement?: string;
    evolutionTresorerie?: string;
    evenementsPosterieurs?: string;
    sections?: Record<string, string>;
    entiteAvecAuditeur?: boolean;
    declarationDirigeants?: string;
}
