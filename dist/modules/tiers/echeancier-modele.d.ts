import { ConditionEcheance, TypeEcheance, TypeJournal } from '@prisma/client';
export interface ModeleLu {
    delaiJours: number;
    echeance: ConditionEcheance;
    modeReglementId: string | null;
}
export interface EcheanceDuModeleLue {
    ordre: number;
    type: TypeEcheance;
    valeur: {
        toString(): string;
    } | number | string | null;
    delaiJours: number;
    echeance: ConditionEcheance;
    modeReglementId: string | null;
}
export interface EcheanceCalculee {
    ordre: number;
    type: TypeEcheance | null;
    montant: number;
    dateEcheance: Date;
    modeReglementId: string | null;
}
export declare function dateEcheanceDuModele(dateFacture: Date, delaiJours: number, condition: ConditionEcheance): Date;
export declare function echeancierDuModele(modele: ModeleLu, echeances: readonly EcheanceDuModeleLue[], dateFacture: Date, montantTotal: number, modeHabituel?: string | null): EcheanceCalculee[];
export declare function motifSansEcheancierDuModele(p: {
    numero: string;
    sens: 'DEBIT' | 'CREDIT';
    typeJournal: TypeJournal | null;
}): string | null;
