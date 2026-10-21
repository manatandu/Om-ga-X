import { Referentiel } from '@prisma/client';
export interface ComptesSuivantLeBien {
    amortissement: string | null;
    dotation: string | null;
    motif: string | null;
}
export declare function comptesSuivantLeBien(referentiel: Referentiel, numeroBien: string, numerosDetail: readonly string[], nonAmortissable?: boolean): ComptesSuivantLeBien;
export declare function estCompteDeBien(referentiel: Referentiel, numero: string): boolean;
export declare function sectionsBaremeDuCompte(numeroBien: string): string[] | null;
export type ModeAcquisition = 'ACHAT_A_CREDIT' | 'ACHAT_COMPTANT' | 'APPORT' | 'FONDS_AFFECTES' | 'SUBVENTION_EN_NATURE' | 'DON_LEGS' | 'PRODUCTION_PROPRE' | 'EN_COURS_ACHEVE' | 'AVANCE_SOLDEE' | 'TITRES_NON_LIBERES' | 'DEMANTELEMENT' | 'CONSTRUCTION_FIN_DE_BAIL';
export declare const LIBELLES_MODE_ACQUISITION: Record<ModeAcquisition, string>;
export declare function modeDeLaRacine(referentiel: Referentiel, racine: string): ModeAcquisition;
export declare function modeDuCompteDeContrepartie(referentiel: Referentiel, numero: string, racines: readonly string[]): ModeAcquisition | null;
