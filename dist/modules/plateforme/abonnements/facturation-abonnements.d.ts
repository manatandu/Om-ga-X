export declare const JOURS_ESSAI = 30;
export type TypeFormule = 'FORMULE' | 'OPTION';
export type Periodicite = 'MENSUELLE' | 'ANNUELLE';
export interface FormulePrix {
    code: string;
    libelle: string;
    type: TypeFormule;
    prixMensuelUsd: number | null;
    prixAnnuelUsd: number | null;
}
export interface AbonnementAFacturer {
    formule: FormulePrix;
    options: FormulePrix[];
    dossiersSupplementaires: number;
    periodicite: Periodicite;
    debut: string;
    finEssai: string | null;
    actif: boolean;
}
export interface LigneAFacturer {
    designation: string;
    quantite: number;
    prixUnitaireUsd: number;
}
export type Verdict = {
    du: true;
    lignes: LigneAFacturer[];
    totalUsd: number;
} | {
    du: false;
    motif: string;
};
export declare const CODE_DOSSIER_SUPPLEMENTAIRE = "DOSSIER_SUPPLEMENTAIRE";
export declare function ajouterJours(jour: string, n: number): string;
export declare function finEssaiDepuis(debut: string): string;
export declare function premierePeriodeFacturable(debut: string, finEssai: string | null): string;
export declare function verdictPeriode(a: AbonnementAFacturer, periode: string): Verdict;
export declare function numeroFactureSuivant(annee: string, existants: string[]): string;
export declare const DELAI_PAIEMENT_JOURS = 15;
export declare function finPeriodeCouverte(periode: string, periodicite: Periodicite): string;
export declare function expirationInitiale(debut: string, finEssai: string | null): string;
export declare function expirationApresPaiement(periode: string, periodicite: Periodicite, actuelle: string | null): string;
export declare function joursDepuis(emiseLe: string, aujourdhui: string): number;
