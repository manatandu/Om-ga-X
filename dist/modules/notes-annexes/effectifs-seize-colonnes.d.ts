import { JeuNotesAnnexes } from '@prisma/client';
import type { ColonneNote } from './note-annexe.types';
export declare const RANG_FORMAT_ANTERIEUR = 100;
export declare const LIBELLES_FORMAT_HUIT_COLONNES: readonly string[];
export declare function colonnesEffectifsSycebnl(): ColonneNote[];
export declare const NOTES_EFFECTIFS_SEIZE_COLONNES: ReadonlyArray<{
    jeu: JeuNotesAnnexes;
    code: string;
}>;
export declare const SOUS_TABLEAU_PERSONNEL_PROPRE = "PERSONNEL PROPRE";
export declare function estTableauEffectifsSeizeColonnes(jeu: JeuNotesAnnexes, code: string, sousTableau?: string): boolean;
export declare function natureColonneAnterieure(rang: number): 'EFFECTIF' | 'MASSE_SALARIALE';
export declare const MOTIF_RETRAIT_MIN = 3;
export declare const MOTIF_RETRAIT_MAX = 500;
export interface SaisieFormatAnterieur {
    cleRubrique: string;
    colonneAnterieure: string;
    nature: 'EFFECTIF' | 'MASSE_SALARIALE';
    valeur: string;
}
