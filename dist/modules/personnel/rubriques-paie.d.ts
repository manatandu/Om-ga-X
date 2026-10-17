import { type NatureElementPaie } from './assiettes-paie';
export declare const NATURES_DES_RUBRIQUES: readonly NatureElementPaie[];
export declare function motifRefusRubrique(r: {
    code?: string;
    libelle?: string;
    nature?: string;
    fondement?: string;
}): string | null;
