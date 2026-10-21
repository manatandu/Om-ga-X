import { JeuNotesAnnexes } from '@prisma/client';
export declare class SaisirNoteDto {
    exerciceId: string;
    jeu: JeuNotesAnnexes;
    codeNote: string;
    cleRubrique: string;
    colonne: number;
    rang?: number;
    valeur?: string | null;
}
export declare class RetirerFormatAnterieurDto {
    exerciceId: string;
    jeu: JeuNotesAnnexes;
    codeNote: string;
    motif: string;
}
