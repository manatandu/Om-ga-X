import { EditionSelection } from '@prisma/client';
type Regle = 'chaine' | 'date' | 'booleen' | 'identifiant' | readonly string[];
export declare const CRITERES_PAR_EDITION: Record<EditionSelection, Record<string, Regle>>;
export declare const LONGUEUR_MAX_CRITERE = 100;
export declare const LONGUEUR_MAX_NOM = 60;
export declare const PLAFOND_SELECTIONS = 200;
export declare function nomOuMotif(brut: unknown): {
    nom: string;
} | {
    motif: string;
};
export declare function criteresSelectionOuMotif(edition: EditionSelection, brut: unknown): {
    criteres: Record<string, string | boolean>;
} | {
    motif: string;
};
export {};
