import type { SpecificationNote } from './note-annexe.types';
export declare function compteSeme(prefixe: string): boolean;
export declare function etiquette(n: SpecificationNote): string;
export declare function toutesLesRubriques(table: SpecificationNote[]): {
    note: SpecificationNote;
    rubrique: import("./note-annexe.types").RubriqueNote;
    index: number;
}[];
export declare function codesDistincts(table: SpecificationNote[]): string[];
