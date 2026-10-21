import type { EcartSaisieNote, SpecificationNote } from './note-annexe.types';
export declare function nombreSaisi(v: string | number | null | undefined): number | null;
export declare function ecartsDesSaisies(spec: SpecificationNote, cellules: ((string | number | null)[] | undefined)[]): (EcartSaisieNote[] | undefined)[];
