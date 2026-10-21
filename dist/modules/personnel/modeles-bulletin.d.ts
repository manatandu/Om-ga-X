import { type NatureElementPaie } from './assiettes-paie';
export declare const NATURES_MODELE: readonly NatureElementPaie[];
export declare const MAX_LIGNES_MODELE = 40;
export interface LigneModeleBulletin {
    nature: string;
    libelle: string;
    rubriqueId?: string | null;
    montant?: number | null;
}
export interface RubriqueConnue {
    id: string;
    nature: string;
    actif: boolean;
}
export declare function motifRefusModele(m: {
    nom?: string;
    deviseStipulation?: string;
    lignes?: LigneModeleBulletin[];
}, rubriques: RubriqueConnue[]): string | null;
export declare function normaliserLignes(lignes: LigneModeleBulletin[], rubriques: RubriqueConnue[]): LigneModeleBulletin[];
