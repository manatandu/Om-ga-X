import { FondementValeurAleatoire, NatureAcquisitionAleatoire, Referentiel } from '@prisma/client';
export type NatureAleatoire = NatureAcquisitionAleatoire;
export declare const COMPTES_PRIX_ALEATOIRE: Readonly<Record<NatureAleatoire, {
    dette: string;
    produitHao: string;
    chargeHao: string;
    source: string;
}>>;
export declare const FONDEMENTS_ADMIS: Readonly<Record<NatureAleatoire, readonly FondementValeurAleatoire[]>>;
export declare const LIBELLE_FONDEMENT_ALEATOIRE: Readonly<Record<FondementValeurAleatoire, string>>;
export declare function motifRefusAcquisitionAleatoire(e: {
    referentiel: Referentiel;
    nature: NatureAleatoire;
    numeroCompteBien: string;
    numeroCompteDette: string;
    comptant: number;
    numeroCompteComptant: string | null;
    valeur: number;
    fondement: FondementValeurAleatoire;
    source: string | null | undefined;
}): string | null;
export declare function lignesCreditAleatoire(e: {
    valeur: number;
    comptant: number;
    compteDetteId: string;
    compteComptantId: string | null;
}): {
    compteId: string;
    montant: number;
}[];
export type SoldeDetteAleatoire = {
    cas: 'EXTINCTION' | 'EXCEDENT' | 'INSUFFISANCE';
    montant: number;
    debiteLaDette: boolean;
    compteContrepartie: string;
} | {
    motif: string;
};
export declare function soldeDetteAleatoire(e: {
    nature: NatureAleatoire;
    detteInitiale: number;
    versementsCumules: number;
}): SoldeDetteAleatoire;
export declare function motifRefusExtinctionAuDelaDuSolde(e: {
    montant: number;
    soldeCrediteur: number;
    numeroCompteDette: string;
}): string | null;
