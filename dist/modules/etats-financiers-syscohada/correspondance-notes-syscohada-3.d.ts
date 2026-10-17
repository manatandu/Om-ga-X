import { SpecificationNote } from '../notes-annexes/note-annexe.types';
export declare const SEUILS_NOTE_35: {
    readonly effectifNote35TitreIX: 250;
    readonly effectifTitreVIIIChapitre30: 500;
};
export interface CodeTable {
    code: string;
    libelle: string;
}
export declare const CODES_FORME_JURIDIQUE_SYSCOHADA: CodeTable[];
export declare const RENVOI_1_FORME_JURIDIQUE_SYSCOHADA = "(1) Remplacer le premier 0 par 1 si l'entit\u00E9 b\u00E9n\u00E9ficie d'un agr\u00E9ment prioritaire.";
export declare const CODES_REGIME_FISCAL_SYSCOHADA: CodeTable[];
export declare const CODES_PAYS_SIEGE_SYSCOHADA: CodeTable[];
export declare const CODES_PAYS_OHADA_SYSCOHADA: CodeTable[];
export declare const CODE_PAYS_OHADA_RDC = "17";
export declare const GROUPES_ACTIVITES_SYSCOHADA: CodeTable[];
export type SourceTermeFicheSynthese = 'COMPTE_RESULTAT' | 'BILAN' | 'FLUX_TRESORERIE' | 'COMPTE' | 'LIGNE';
export interface TermeFicheSynthese {
    signe: 1 | -1;
    source: SourceTermeFicheSynthese;
    ref: string;
    solde?: 'DEBITEUR' | 'CREDITEUR';
    motif?: string;
    horsMaquette?: boolean;
}
export type SectionFicheSynthese = 'ACTIVITE' | 'CAPACITE_AUTOFINANCEMENT' | 'RENTABILITE' | 'STRUCTURE_FINANCIERE' | 'VARIATION_TRESORERIE' | 'ENDETTEMENT_FINANCIER_NET';
export interface LigneFicheSynthese {
    cle: string;
    section: SectionFicheSynthese;
    libelle: string;
    formuleOfficielle?: string;
    termes?: TermeFicheSynthese[];
    ratio?: {
        numerateur: TermeFicheSynthese[];
        denominateur: TermeFicheSynthese[];
    };
    renvoi?: string;
    horsMaquette?: boolean;
    controleDe?: string;
}
export declare const RENVOI_B_NOTE_34: string;
export declare const RENVOI_A_NOTE_34 = "(a) R\u00E9sultat d\u2019exploitation apr\u00E8s imp\u00F4t th\u00E9orique sur le b\u00E9n\u00E9fice.";
export declare const MARQUE_HORS_MAQUETTE_NOTE_34: string;
export declare const RENVOI_DETTES_FINANCIERES_NOTE_34 = "Dettes financi\u00E8res* = emprunts et dettes financi\u00E8res diverses + dettes de location acquisition (DA + DB).";
export declare const FICHE_SYNTHESE_SYSCOHADA: LigneFicheSynthese[];
export declare const NOTES_SYSCOHADA_3: SpecificationNote[];
export declare const CODES_NOTES_SYSCOHADA_3: string[];
