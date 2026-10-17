export type ModePaiement = 'VIREMENT' | 'CHEQUE' | 'ESPECES';
export declare const MODES_PAIEMENT: Readonly<Record<ModePaiement, {
    libelle: string;
    caisse: boolean;
}>>;
export declare const PLAFOND_LIGNES_PAIEMENT = 500;
export declare const PLAFOND_COUPURES = 20;
export interface JournalDuPaiement {
    code: string;
    type: string;
    estActif: boolean;
    compteTresorerie: {
        numero: string;
    } | null;
}
export declare function motifRefusJournalDuPaiement(mode: ModePaiement, journal: JournalDuPaiement | null, deviseDuRib: string | null): string | null;
export declare function motifRefusCoupures(coupures: readonly number[]): string | null;
export interface Billetage {
    detail: {
        valeur: number;
        nombre: number;
    }[];
    reste: number;
}
export declare function billetage(montant: number, coupures: readonly number[]): Billetage;
export interface BilletageDuPaiement {
    coupures: number[];
    parSalarie: {
        salarieId: string;
        nomComplet: string;
        montant: number;
        detail: Billetage['detail'];
        reste: number;
    }[];
    totaux: {
        valeur: number;
        nombre: number;
    }[];
    resteTotal: number;
}
export declare function billetageDuPaiement(lignes: readonly {
    salarieId: string;
    nomComplet: string;
    montant: number;
}[], coupures: readonly number[]): BilletageDuPaiement;
export declare function echeanceArticle99(mois: string): string;
export interface BulletinAPayer {
    id: string;
    salarieId: string;
    netAPayer: number;
    dejaPayeAutres: number;
}
export declare function resteAPayer(b: BulletinAPayer): {
    montant: number;
    tropPaye: number;
};
export declare function motifRefusReferencesCheques(references: readonly {
    nomComplet: string;
    reference: string | null;
}[]): string | null;
