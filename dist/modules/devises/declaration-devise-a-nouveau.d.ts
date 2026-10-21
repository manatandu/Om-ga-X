import { Referentiel, StatutEcriture, StatutExercice } from '@prisma/client';
export interface PartDeclaree {
    deviseId: string;
    montantDevise: number;
    coursApplique?: number | null;
    montant: number;
}
export interface LigneADeclarer {
    numero: string;
    debit: number;
    credit: number;
    deviseId: string | null;
    lettre: string | null;
    lettrageId: string | null;
    rapprochementId: string | null;
    aDesVentilations: boolean;
    ecriture: {
        estGenereeParCloture: boolean;
        estANouveauProvisoire: boolean;
        estSoldeDesComptesDeGestion: boolean;
        statut: StatutEcriture;
        exercice: {
            statut: StatutExercice;
            dateDebut: Date;
            dateFin: Date;
        };
    };
}
export declare function estLigneDANouveauDeclarable(e: LigneADeclarer['ecriture']): boolean;
export declare const PARTS_MAXIMUM = 20;
export interface ReglementEnFrancs {
    piece: number | null;
    date: Date;
    montant: number;
}
export interface ContexteDeclaration {
    dejaDeclaree: boolean;
    reevaluationLue: {
        date: Date;
        exercice: string;
        memeExercice: boolean;
    } | null;
    exercicePrecedentOuvert: {
        libelle: string;
    } | null;
    prolongeUneLigneDeclaree: boolean;
    reglementsEnFrancs: {
        lignes: ReglementEnFrancs[];
        total: number;
    };
}
export declare function motifRefusLigne(l: LigneADeclarer, referentiel: Referentiel, contexte: ContexteDeclaration): string | null;
export declare function motifRefusParts(parts: PartDeclaree[], montantLigne: number, devisesDuDossier: Map<string, {
    code: string;
}>): string | null;
export interface LigneExacte {
    montant: number;
    deviseId: string | null;
    montantDevise: number | null;
    coursApplique: number | null;
    sensDebit: boolean;
}
export declare function lignesExactes(l: {
    debit: number;
    credit: number;
}, parts: PartDeclaree[]): LigneExacte[];
export interface LigneDeReport {
    id: string;
    compteId: string;
    debit: number;
    credit: number;
    libelle: string | null;
    dateEcheance: Date | null;
}
export declare function cleDeLigne(l: LigneDeReport): string;
export declare function cleDuReport(l: LigneDeReport, numeroCompte: string): string;
export declare function apparierReports<O extends {
    id: string;
}, R extends {
    id: string;
}>(origines: Array<{
    ligne: O;
    cle: string;
}>, reports: Array<{
    ligne: R;
    cle: string;
}>): {
    herites: R[];
    nonRetrouvees: O[];
    ambigues: O[];
};
