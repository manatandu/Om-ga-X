import { EtatsIfrs } from './etats-ifrs';
export type ComposanteCp = 'CAPITAL' | 'RESERVES' | 'AUTRES_COMPOSANTES' | 'MINORITAIRES';
export type TypeMouvementCp = 'CHANGEMENT_METHODE' | 'CORRECTION_ERREUR' | 'APPORT' | 'DISTRIBUTION' | 'TRANSFERT' | 'VARIATION_PARTS_INTERETS';
export interface MouvementCpDeclare {
    type: TypeMouvementCp;
    composante: ComposanteCp;
    montant: number;
    libelle: string;
    justification: string;
}
export interface LigneVariationCp {
    cle: string;
    libelle: string;
    ref?: string;
    nature: 'SOLDE' | 'MOUVEMENT' | 'TOTAL' | 'ECART';
    capital: number;
    reserves: number;
    autres: number;
    groupe?: number;
    minoritaires?: number;
    total: number;
}
export interface VariationCapitauxPropres {
    lignes: LigneVariationCp[];
    mentions: string[];
    motifsNonPubliable: string[];
}
export declare const COMPOSANTES_CP: Record<ComposanteCp, {
    libelle: string;
    rubriques: string[];
}>;
export declare function motifRefusMouvementCp(m: Pick<MouvementCpDeclare, 'type' | 'montant' | 'libelle' | 'justification'> & {
    composante?: ComposanteCp;
}, consolide?: boolean): string | null;
export declare function composantesDe(e: EtatsIfrs, ordre?: ComposanteCp[]): Record<ComposanteCp, number>;
export declare function construireVariationCapitauxPropres(cloture: EtatsIfrs, ouverture: EtatsIfrs | null, mouvements: MouvementCpDeclare[]): VariationCapitauxPropres;
export declare function construireVariationCapitauxPropresConsolidee(cloture: EtatsIfrs, ouverture: EtatsIfrs | null, mouvements: MouvementCpDeclare[]): VariationCapitauxPropres;
