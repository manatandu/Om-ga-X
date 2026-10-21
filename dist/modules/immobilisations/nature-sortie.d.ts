import { NatureSortieImmobilisation } from '@prisma/client';
export declare const NATURES_SORTIE: readonly NatureSortieImmobilisation[];
export declare const LIBELLES_NATURE_SORTIE: Record<NatureSortieImmobilisation, string>;
export interface ContexteNatureSortie {
    nature: NatureSortieImmobilisation;
    type: 'CESSION' | 'MISE_HORS_SERVICE';
    projetDeveloppement: boolean;
    usufruit: boolean;
    depuisEchange?: boolean;
}
export declare function motifRefusNatureSortie(c: ContexteNatureSortie): string | null;
export declare function motifRefusPieceSortie(reference: string | null | undefined, date: Date | null): string | null;
export declare function libelleSortie(opts: {
    projet: boolean;
    type: 'CESSION' | 'MISE_HORS_SERVICE';
    nature: NatureSortieImmobilisation | null | undefined;
    designation: string;
}): string;
