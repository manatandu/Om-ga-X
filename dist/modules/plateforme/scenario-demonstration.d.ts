import { Referentiel, SexeTravailleur, TypeContratTravail, TypeTiers } from '@prisma/client';
export type JournalDemo = 'ACH' | 'VEN' | 'BQ' | 'OD';
type Sens = 'DEBIT' | 'CREDIT';
export type CompteDemo = {
    nature: string;
    sens: Sens;
} | {
    tiers: string;
    sens: Sens;
} | {
    tresorerie: true;
    sens: Sens;
};
export type LigneDemo = CompteDemo & {
    montant: number;
};
export interface OperationDemo {
    jour: string;
    journal: JournalDemo;
    libelle: string;
    reference?: string;
    lignes: LigneDemo[];
}
export interface ImmobilisationDemo {
    jour: string;
    designation: string;
    numeroInventaire: string;
    famille: 'INFORMATIQUE' | 'MOBILIER';
    valeur: number;
}
export interface SalarieDemo {
    matricule: string;
    nom: string;
    prenoms: string;
    sexe: SexeTravailleur;
    nationalite: string;
    natureTravail: string;
    type: TypeContratTravail;
    remunerationMensuelleFc: number;
    moisBulletin: string;
}
export interface ScenarioDemo {
    nomEntite: string;
    activite: string;
    tiers: {
        code: string;
        nom: string;
        type: TypeTiers;
    }[];
    operations: OperationDemo[];
    immobilisations: ImmobilisationDemo[];
    salarie: SalarieDemo;
    jourReleve: string;
    questionnaire: string;
}
export declare function mouvementsBanque(s: ScenarioDemo): {
    jour: string;
    montant: number;
}[];
export declare function scenarioDemonstration(referentiel: Referentiel): ScenarioDemo;
export {};
