export type ModeRan = 'AUCUN' | 'SOLDE' | 'DETAIL';
export declare function horsDuReport(numero: string, referentiel: 'SYSCOHADA' | 'SYCEBNL'): boolean;
export interface LigneLueRan {
    id?: string;
    debit: number;
    credit: number;
    lettre: string | null;
    libelle: string;
    dateEcheance: Date | null;
    deviseId?: string | null;
    montantDevise?: number | null;
    coursApplique?: number | null;
}
export interface SommeEnDeviseRan {
    deviseId: string;
    sens: 1 | -1;
    debit: number;
    credit: number;
    montantDevise: number;
}
export interface SommesRan {
    debit: number;
    credit: number;
    enDevise: SommeEnDeviseRan[];
}
export interface CompteRan {
    id: string;
    numero: string;
    intitule: string;
    modeReportANouveau: ModeRan;
    lignes?: LigneLueRan[];
    sommes?: SommesRan;
}
export interface LigneRan {
    compteId: string;
    debit: number;
    credit: number;
    libelle: string;
    dateEcheance?: Date | null;
    deviseId?: string;
    montantDevise?: number;
    coursApplique?: number;
    origineId?: string;
}
export declare function ligneAEcrire(l: LigneRan, id?: string): Omit<LigneRan, 'origineId'> & {
    id?: string;
};
export declare function sommesDesLignes(lignes: LigneLueRan[]): SommesRan;
export declare function soldeDuCompte(c: CompteRan): number;
export declare function resultatDesComptesDeGestion(comptes: CompteRan[]): number;
export declare function lignesReportANouveau(comptes: CompteRan[], resultat: {
    compteId: string;
    montant: number;
} | null): LigneRan[];
export interface LigneOuverturePassee {
    id?: string;
    compteId: string;
    debit: number;
    credit: number;
    libelle: string | null;
    dateEcheance: Date | null;
    deviseId: string | null;
    montantDevise: number | null;
    coursApplique: number | null;
}
export interface EcartOuverture {
    compteId: string;
    deviseId: string | null;
    cloture: number;
    ouverture: number;
    clotureDevise: number | null;
    ouvertureDevise: number | null;
}
export declare function confrontationDeLOuverture(report: LigneRan[], passees: LigneOuverturePassee[]): EcartOuverture[];
export declare function ouvertureNulle(passees: LigneOuverturePassee[]): boolean;
export declare function rectificationDeLOuverture(report: LigneRan[], passees: LigneOuverturePassee[]): {
    lignes: LigneRan[];
    comptesRectifies: string[];
    negatifs: {
        rang: number;
        origine: LigneOuverturePassee;
    }[];
};
export interface LigneTenue {
    compteId: string;
    debit: number;
    credit: number;
    dateEcheance: Date | null;
    deviseId: string | null;
    montantDevise: number | null;
    lettre: string | null;
    lettrageId: string | null;
    rapprochementId: string | null;
    ligneReleveId: string | null;
    figee?: boolean;
}
export interface LigneCandidate {
    id: string;
    compteId: string;
    debit: number;
    credit: number;
    dateEcheance: Date | null;
    deviseId: string | null;
    montantDevise: number | null;
}
export declare function apparierTenues(tenues: LigneTenue[], candidates: LigneCandidate[]): (string | null)[];
export declare function budgetsAReporter(budgets: {
    sectionId: string;
    mois: number | null;
    montant: number;
}[], dejaDotes: {
    sectionId: string;
    mois: number | null;
}[], sectionsCloses: Set<string>): {
    sectionId: string;
    mois: number | null;
    montant: number;
}[];
