import { Referentiel } from '@prisma/client';
import { CorrespondanceStock } from './nomenclature-stocks';
export interface CompteAVarier {
    numero: string;
    intitule: string;
    soldeInitial: number;
    stockFinal: number | null;
    source: string;
}
export type MotifRefus = 'PAS_UN_COMPTE_DE_STOCK' | 'HORS_VARIATION_AUTOMATIQUE' | 'STOCK_FINAL_NON_COMPTE' | 'STOCK_FINAL_NEGATIF' | 'SOURCE_ABSENTE';
export interface LigneProposee {
    compte: string;
    sens: 'DEBIT' | 'CREDIT';
    montant: number;
    libelle: string;
}
export interface VariationRefusee {
    numero: string;
    motif: MotifRefus;
    explication: string;
}
export interface VariationRetenue {
    numero: string;
    correspondance: CorrespondanceStock;
    soldeInitial: number;
    stockFinal: number;
    source: string;
    lignes: LigneProposee[];
}
export interface PropositionVariation {
    retenues: VariationRetenue[];
    refusees: VariationRefusee[];
    sansMouvement: string[];
    avertissements: string[];
}
export declare function proposerVariations(comptes: CompteAVarier[], referentiel: Referentiel): PropositionVariation;
export declare function lignesDeLEcriture(proposition: PropositionVariation): LigneProposee[];
export declare function totaux(lignes: LigneProposee[]): {
    debit: number;
    credit: number;
};
