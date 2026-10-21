import { JeuEtatsFinanciersSycebnl } from '@prisma/client';
export type CleEtatInventaire = 'bilan' | 'compteDeResultat' | 'tableauFluxTresorerie' | 'tableauEmploisRessources' | 'tableauExecutionBudgetaire' | 'tableauReconciliationTresorerie' | 'compteExploitation';
export interface EtatATranscrire {
    cle: CleEtatInventaire;
    libelle: string;
    disponible: boolean;
    motifIndisponibilite?: string;
}
export declare const ETATS_INVENTAIRE_ASSOCIATIONS: EtatATranscrire[];
export declare const ETATS_INVENTAIRE_PROJETS: EtatATranscrire[];
export declare const ETATS_INVENTAIRE_SMT: EtatATranscrire[];
export declare function etatsExigesPar(jeu: JeuEtatsFinanciersSycebnl): EtatATranscrire[];
export interface SectionRapportActivite {
    cle: 'situationExerciceEcoule' | 'perspectivesDeveloppement' | 'evolutionTresorerie' | 'evenementsPosterieurs';
    titre: string;
    exigence: string;
}
export declare const SECTIONS_RAPPORT_ACTIVITE: SectionRapportActivite[];
