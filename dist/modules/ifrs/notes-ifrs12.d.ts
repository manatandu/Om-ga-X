import { ResultatEntite } from '../consolidation/perimetre-consolidation';
import { NoteIfrs } from './notes-ifrs';
export interface DeclarationFilialeIfrs12 {
    etablissement: string | null;
    resultatMinoritaires: number | null;
    cumulMinoritaires: number | null;
    dividendesMinoritaires: number | null;
}
export type TypePartenariat = 'ENTREPRISE_COMMUNE' | 'COENTREPRISE';
export interface DeclarationPartenaireIfrs12 {
    etablissement: string | null;
    natureRelation: string | null;
    typePartenariat: TypePartenariat | null;
    dividendesRecus: number | null;
}
export interface DeclarationsIfrs12 {
    jugements: string | null;
    restrictions: string | null;
    datesCloture: string | null;
    entitesStructurees: boolean | null;
    filiales: Record<string, DeclarationFilialeIfrs12>;
    partenaires: Record<string, DeclarationPartenaireIfrs12>;
}
export interface EntreesIfrs12 {
    entites: ResultatEntite[];
    declarations: DeclarationsIfrs12;
    totaux: {
        resultatMinoritaires: number;
        cumulMinoritaires: number;
    };
    variationsPartsInterets: {
        libelle: string;
        groupe: number;
        minoritaires: number;
    }[];
}
export declare function normaliserDeclarationsIfrs12(brut: unknown): DeclarationsIfrs12;
export declare function construireNoteIfrs12(p: EntreesIfrs12): {
    note: Omit<NoteIfrs, 'numero'>;
    motifs: string[];
};
