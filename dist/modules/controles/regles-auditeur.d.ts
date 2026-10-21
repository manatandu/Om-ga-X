import { FormeJuridiqueSyscohada, Referentiel } from '@prisma/client';
export type RegleAuditeur = {
    genre: 'ALTERNATIF';
    source: string;
    seuilBilan: number;
    seuilProduits: number;
    libelleProduits: string;
    seuilEffectif: number;
} | {
    genre: 'DEUX_SUR_TROIS';
    source: string;
    seuilBilan: number;
    seuilProduits: number;
    libelleProduits: string;
    seuilEffectif: number;
} | {
    genre: 'TOUJOURS';
    source: string;
    motif: string;
} | {
    genre: 'AUCUNE_REGLE_LUE';
    motif: string;
};
export declare const REGLE_SYCEBNL: RegleAuditeur;
export declare const MOTIF_COOPERATIVE: string;
export declare const MOTIF_GIE_SANS_OBLIGATIONS: string;
export declare const REGLE_GIE_EMETTEUR: RegleAuditeur;
export declare function regleAuditeur(referentiel: Referentiel, formeSyscohada: FormeJuridiqueSyscohada | null, gieEmetDesObligations?: boolean | null): RegleAuditeur;
