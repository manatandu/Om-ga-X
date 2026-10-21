import { EditionModele, SautEdition } from '@prisma/client';
export interface ColonneModele {
    cle: string;
    identifiante: boolean;
}
export declare const COLONNES_PAR_EDITION: Record<EditionModele, ColonneModele[]>;
export declare const LONGUEUR_MAX_NOM_MODELE = 60;
export declare const NOM_STANDARD = "Standard";
export declare const PLAFOND_MODELES = 100;
export declare function modeleOuMotif(edition: EditionModele, brut: {
    nom?: unknown;
    colonnes?: unknown;
    saut?: unknown;
}, avecNom?: boolean): {
    nom: string;
    colonnes: string[];
    saut: SautEdition;
} | {
    motif: string;
};
