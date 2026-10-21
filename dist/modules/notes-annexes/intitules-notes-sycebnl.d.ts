import { JeuNotesAnnexes } from '@prisma/client';
export declare const INTITULES_FICHE_ASSOCIATIONS: Readonly<Record<string, string>>;
export declare const TITRES_DE_NOTE_ASSOCIATIONS: Readonly<Record<string, string>>;
export declare const INTITULES_FICHE_PROJETS: Readonly<Record<string, string>>;
export declare const TITRES_DE_NOTE_PROJETS: Readonly<Record<string, string>>;
export declare function intituleSurLaFiche(jeu: JeuNotesAnnexes, code: string, repli: string): string;
export declare function titreDeLaNote(jeu: JeuNotesAnnexes, code: string, repli: string): string;
