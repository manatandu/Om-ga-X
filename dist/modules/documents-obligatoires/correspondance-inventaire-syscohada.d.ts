import { FormeJuridiqueSyscohada, SystemeComptableSyscohada } from '@prisma/client';
import type { EtatATranscrire } from './correspondance-inventaire';
export declare const ETATS_INVENTAIRE_SYSTEME_NORMAL: EtatATranscrire[];
export declare const ETATS_INVENTAIRE_SMT_SYSCOHADA: EtatATranscrire[];
export declare function etatsExigesParSysteme(systeme: SystemeComptableSyscohada | null): EtatATranscrire[];
export interface SectionRapportGestion {
    cle: string;
    titre: string;
    exigence: string;
}
export declare const SECTIONS_RAPPORT_GESTION_AUSCGIE: SectionRapportGestion[];
export declare const SECTION_MODIFICATIONS_AUSCGIE: SectionRapportGestion;
export declare const SECTION_PARTICIPATION_SALARIES_SA: SectionRapportGestion;
export declare const SECTIONS_RAPPORT_GESTION_AUSCOOP: SectionRapportGestion[];
export type RegleRapportGestion = {
    genre: 'EXIGE';
    source: string;
    organe: string;
    sections: SectionRapportGestion[];
} | {
    genre: 'AUCUNE_REGLE_LUE';
    motif: string;
};
export declare function regleRapportGestion(forme: FormeJuridiqueSyscohada | null): RegleRapportGestion;
