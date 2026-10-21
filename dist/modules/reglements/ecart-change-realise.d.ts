import type { SensReglement } from './reglement-tiers';
export type Referentiel = 'SYCEBNL' | 'SYSCOHADA';
export type NatureCreanceDette = 'COMMERCIALE' | 'FINANCIERE';
export declare function natureDuCompte(numero: string, referentiel: Referentiel): NatureCreanceDette | null;
export declare function comptesPrescrits(referentiel: Referentiel, nature: NatureCreanceDette | null): {
    perte: string;
    gain: string;
} | {
    perte: null;
    gain: null;
    motif: string;
};
export declare function racineDuPrescrit(numero: string): string;
export interface RacineAdmise {
    racine: string;
    sauf?: string;
}
export declare function racinesAdmises(referentiel: Referentiel, nature: NatureCreanceDette | null, ecart: 'PERTE' | 'GAIN'): RacineAdmise[];
export declare function compteAdmisPourEcart(racines: RacineAdmise[], numero: string): boolean;
export declare function motifRefusCompteEcart(params: {
    referentiel: Referentiel;
    nature: NatureCreanceDette | null;
    ecart: 'PERTE' | 'GAIN';
    numero: string;
}): string | null;
export declare function libelleEcartRealise(ecart: number): string;
export declare function coursEtFrancsDuReglement(p: {
    montantDevise: number;
    cours?: number | null;
    francs?: number | null;
    tolerance: (montantDevise: number, cours: number, francs: number) => boolean;
}): {
    cours: number;
    francs: number;
} | {
    motif: string;
};
export declare function motifRefusTresorerieEnDevise(p: {
    tresorerieEnDevise: boolean;
    devisesDuLot: Array<{
        id: string;
        code: string;
    } | null>;
    deviseTresorerie: {
        id: string;
        code: string;
    } | null;
    deviseRib: string | null;
    monnaieDeTenue: string;
    journalCode: string;
}): string | null;
export interface FactureEnDevise {
    id: string;
    francs: number;
    montantDevise: number;
    date: Date;
}
export declare function ordreDeReglement<T extends {
    id: string;
    date: Date;
}>(a: T, b: T): number;
export declare function coutHistoriqueRegle(factures: FactureEnDevise[], montantDeviseRegle: number): number;
export declare function coutsHistoriquesSuccessifs(factures: FactureEnDevise[], montantsDevise: number[]): number[];
export declare function ecartSigne(sens: SensReglement, historique: number, francsPayes: number): number;
export interface LigneDuReglementEnDevise {
    compteId: string;
    debit?: number;
    credit?: number;
    libelle: string;
    deviseId?: string;
    montantDevise?: number;
    coursApplique?: number;
}
export declare function lignesDuReglementEnDevise(p: {
    sens: SensReglement;
    compteTiersId: string;
    compteTresorerieId: string;
    compteEcartId: string | null;
    historique: number;
    francsPayes: number;
    deviseId: string;
    montantDevise: number;
    coursReglement: number;
    tresorerieEnDevise: boolean;
    libelle: string;
}): LigneDuReglementEnDevise[];
export declare function ecartDuGroupe(lignes: Array<{
    debit: number;
    credit: number;
    deviseId: string | null;
    montantDevise: number | null;
}>): {
    deviseId: string;
    ecart: number;
} | null;
export declare function lignesEcartDuGroupe(p: {
    compteTiersId: string;
    compteEcartId: string;
    ecart: number;
    libelle: string;
}): LigneDuReglementEnDevise[];
