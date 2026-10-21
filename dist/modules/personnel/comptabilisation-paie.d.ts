import { type BlocPaie, type EntreePassation, type Referentiel, type SensLigne } from './passation-paie';
export type BulletinAComptabiliser = {
    readonly id: string;
    readonly numero: number;
    readonly nomComplet: string;
    readonly statut: 'EMIS' | 'ANNULE';
    readonly ecritureId: string | null;
    readonly netAPayerFc: number;
    readonly entree: unknown;
    readonly calcul: unknown;
    readonly ecritureNegatifId?: string | null;
    readonly origine?: OrigineDuBulletin | null;
};
export type OrigineDuBulletin = {
    readonly ecritureId: string;
    readonly numeroPiece?: string | null;
    readonly lignes: readonly {
        readonly compte: string;
        readonly intitule: string;
        readonly debit: number;
        readonly credit: number;
        readonly ventilations?: readonly {
            readonly planId: string;
            readonly sectionId: string;
            readonly montant: number;
        }[];
    }[];
};
export type RepriseDuMois = {
    readonly ecritureId: string;
    readonly mode: 'EXACTE' | 'REJEU';
    readonly bulletinIds: readonly string[];
};
export type BlocDuMois = BlocPaie | 'REPRISE_EN_NEGATIF';
export type LigneDuMois = {
    readonly bloc: BlocDuMois;
    readonly compte: string;
    readonly intitule: string;
    readonly sens: SensLigne;
    readonly montantFc: number;
    readonly negatif?: boolean;
};
export type PropositionPaieDuMois = {
    readonly moisDePaie: string;
    readonly referentiel: Referentiel;
    readonly aPasser: readonly {
        id: string;
        numero: number;
        nomComplet: string;
    }[];
    readonly dejaPasses: readonly {
        numero: number;
        nomComplet: string;
        ecritureId: string;
    }[];
    readonly annulesApresPassation: readonly {
        numero: number;
        nomComplet: string;
        ecritureId: string;
        ecritureNegatifId: string | null;
    }[];
    readonly negatifsAPasser: readonly {
        id: string;
        numero: number;
        nomComplet: string;
        ecritureId: string;
    }[];
    readonly reprises: readonly RepriseDuMois[];
    readonly refus: readonly {
        numero: number;
        nomComplet: string;
        motifs: readonly string[];
    }[];
    readonly lignes: readonly LigneDuMois[];
    readonly totalDebitFc: number;
    readonly totalCreditFc: number;
    readonly equilibree: boolean;
    readonly solde422Fc: number;
    readonly sommeDesNetsFc: number;
    readonly reserves: readonly string[];
};
export declare const TOTAL_DU_BLOC: Readonly<Record<BlocPaie, {
    role: 'REMUNERATIONS_DUES' | 'CHARGES_SOCIALES_PATRONALES' | 'AUTRES_IMPOTS_ET_TAXES' | 'TRANSFERTS_DE_CHARGES';
    sens: SensLigne;
}>>;
export declare function entreeDuBulletin(b: BulletinAComptabiliser, referentiel: Referentiel): EntreePassation | null;
export declare function propositionPaieDuMois(moisDePaie: string, referentiel: Referentiel, bulletins: readonly BulletinAComptabiliser[]): PropositionPaieDuMois;
export declare const MOTIF_ORIGINE_INTROUVABLE: string;
export declare const motifPartIllisible: (origine: OrigineDuBulletin, autres: readonly number[]) => string;
export declare const RESERVE_REPRISE_EN_NEGATIF: (numeros: readonly number[]) => string;
export declare function dernierJourDuMois(moisDePaie: string): string;
