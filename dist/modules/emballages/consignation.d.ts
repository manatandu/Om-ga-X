import { Referentiel } from '@prisma/client';
export type SensConsignation = 'EMISE' | 'RECUE';
export type NatureObjetConsigne = 'EMBALLAGE' | 'MATERIEL';
export type ModeDenouement = 'RESTITUTION' | 'CONSERVATION' | 'REPRISE_PRIX_INFERIEUR';
export type MotifRefusDenouement = 'PRIX_DE_REPRISE_MANQUANT' | 'PRIX_DE_REPRISE_NON_INFERIEUR' | 'CESSION_IMMOBILISATION_HORS_MODULE' | 'MONTANT_NON_POSITIF';
export interface Consignation {
    sens: SensConsignation;
    nature: NatureObjetConsigne;
    compteTiers: string;
    intituleTiers: string;
    montant: number;
    designation: string;
}
export interface LigneConsignation {
    compte: string;
    intitule: string;
    libelle: string;
    sens: 'DEBIT' | 'CREDIT';
    montant: number;
    reserve?: string;
}
export interface RefusDenouement {
    motif: MotifRefusDenouement;
    explication: string;
}
export interface PropositionDenouement {
    lignes: LigneConsignation[];
    refus: RefusDenouement | null;
    reserves: string[];
}
export declare function lignesDeLaConsignation(c: Consignation, referentiel: Referentiel): PropositionDenouement;
export declare function lignesDuDenouement(c: Consignation, mode: ModeDenouement, referentiel: Referentiel, prixDeReprise?: number | null): PropositionDenouement;
export declare const RESERVE_TVA: string;
