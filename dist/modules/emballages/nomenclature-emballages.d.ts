import { Referentiel } from '@prisma/client';
export interface CompteEmballage {
    role: RoleCompteEmballage;
    numero: string;
    intitule: string;
}
export type RoleCompteEmballage = 'CREANCE_CONSIGNATION' | 'DETTE_CONSIGNATION' | 'ACHAT_EMBALLAGE_RECUPERABLE' | 'MALI_SUR_EMBALLAGES' | 'BONI_SUR_EMBALLAGES' | 'MATERIEL_EMBALLAGE' | 'PRODUIT_CESSION_IMMO' | 'VALEUR_COMPTABLE_CESSION';
export declare function comptesDuReferentiel(referentiel: Referentiel): CompteEmballage[];
export declare function compteDuRole(role: RoleCompteEmballage, referentiel: Referentiel): CompteEmballage;
export declare const RESERVE_DESCENTE: string;
