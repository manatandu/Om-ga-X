import { ResultatEntite } from './perimetre-consolidation';
export type MethodeNote = 'IG' | 'IP' | 'ME' | 'NC';
export interface LigneNotePerimetre {
    denomination: string;
    estConsolidante: boolean;
    secteurActivite: string | null;
    pctControleN: number;
    pctControleN1: number | null;
    methodeN: MethodeNote;
    methodeN1: MethodeNote | null;
    pctInteretN: number;
    pctInteretN1: number | null;
    entree: boolean;
}
export interface JustificationPerimetre {
    denomination: string;
    fondement: string;
    aJustifier: string[];
    exclusion: {
        libelle: string;
        justification: string;
    } | null;
}
export interface NotePerimetre {
    lignes: LigneNotePerimetre[];
    sorties: string[];
    justifications: JustificationPerimetre[];
    comparatifDisponible: boolean;
    controleHorsOhada: string | null;
}
export declare function noteDuPerimetre(n: ResultatEntite[], secteurs: Map<string, string | null>, n1: ResultatEntite[] | null, controleHorsOhada?: string | null): NotePerimetre;
