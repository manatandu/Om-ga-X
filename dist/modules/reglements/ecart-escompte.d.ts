import type { Referentiel } from './ecart-change-realise';
export type RoleEcartEscompte = 'ESCOMPTE_OBTENU' | 'ESCOMPTE_ACCORDE' | 'ECART_REGLEMENT';
export type SensReglement = 'FOURNISSEUR' | 'CLIENT';
export declare const RACINES_ECART_ESCOMPTE: Readonly<Record<Referentiel, Readonly<Record<RoleEcartEscompte, string>>>>;
export declare function roleEscompte(sens: SensReglement): RoleEcartEscompte;
export interface CompteCandidat {
    id: string;
    numero: string;
    intitule: string;
}
export declare function comptesOfferts(referentiel: Referentiel, role: RoleEcartEscompte, candidats: readonly CompteCandidat[]): CompteCandidat[];
export declare function compteDuRole(referentiel: Referentiel, role: RoleEcartEscompte, candidats: readonly CompteCandidat[], choisiId: string | undefined): {
    compte: CompteCandidat;
} | {
    motif: string;
};
export interface PlanDuReglement {
    tiers: number;
    ecart: number;
    partiel: boolean;
}
export declare function planDuReglement(p: {
    sens: SensReglement;
    referentiel: Referentiel;
    numeroTiers: string;
    du: number;
    montant: number;
    escompte: number;
    solderEcart: boolean;
    seuil: number | null;
}): PlanDuReglement | {
    motif: string;
};
export interface LigneDuReglement {
    compteId: string;
    debit?: number;
    credit?: number;
    libelle: string;
}
export interface MontantAuCompte {
    montant: number;
    compteId: string;
}
export declare function lignesAvecEscompteEtEcart(p: {
    sens: SensReglement;
    compteTiersId: string;
    compteTresorerieId: string;
    montant: number;
    plan: PlanDuReglement;
    escompte: MontantAuCompte | null;
    ecart: MontantAuCompte | null;
    libelle: string;
}): LigneDuReglement[];
export declare function avertissementEscompteApresEcheance(numero: string, dateReglement: Date, echeances: ReadonlyArray<{
    reference: string;
    echeance: Date;
}>): string | null;
export declare function avertissementTvaEscompte(numero: string, escompte: number): string;
export declare function avertissementTvaEcart(numero: string, ecart: number): string;
