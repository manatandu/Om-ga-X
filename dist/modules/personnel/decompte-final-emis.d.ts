import type { NatureElementPaie } from './assiettes-paie';
import { auCentime } from './au-centime';
import { type VerdictDecompteFinal } from './decompte-final';
export declare const NATURE_DES_RUBRIQUES: Readonly<Record<string, NatureElementPaie>>;
export declare const CLE_ARRIERES = "arrieres";
export declare const RESERVE_VERSEMENT_UNIQUE: string;
export declare const RESERVE_DU_PAR_LE_TRAVAILLEUR: string;
export declare const RESERVE_EN_FRANCS: string;
export declare const FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE: string;
export declare const RESERVE_REMUNERATION_ARTICLE_66: string;
export declare const AVERTISSEMENT_SANS_COMPTE: string;
export type NatureVentilation = 'LOGEMENT_OU_SON_INDEMNITE' | 'INDEMNITE_DE_TRANSPORT' | 'SOINS_DE_SANTE' | 'REMUNERATION';
export type VentilationAvantage = {
    readonly rubrique: string;
    readonly nature: NatureVentilation;
    readonly libelle: string;
    readonly montantFc: number;
    readonly conditionArticle69Attestee?: boolean;
};
export type ElementDecompte = {
    readonly nature: NatureElementPaie;
    readonly libelle: string;
    readonly montantFc: number;
    readonly cleRubrique: string;
    readonly conditionArticle69Attestee?: boolean;
    readonly reserve: string | null;
};
export { auCentime };
export declare const MOTIF_GRATIFICATION = "D\u00E9clarez la gratification, z\u00E9ro compris.";
export declare function elementsDuDecompte(verdict: VerdictDecompteFinal, ventilation?: readonly VentilationAvantage[]): {
    elements: ElementDecompte[];
    refus: string[];
};
export declare const NATURES_PROPRES_AU_DECOMPTE: readonly NatureElementPaie[];
export declare function motifsDoubleCompte(elementsDuMois: readonly {
    nature: NatureElementPaie;
    montantFc: number;
}[], indemnites: readonly ElementDecompte[]): string[];
export declare function motifsElementsNegatifs(elements: readonly {
    libelle: string;
    montantFc: number;
}[]): string[];
export declare function avertissementsPassation(elements: readonly {
    nature: string;
}[], sansImputation: Readonly<Partial<Record<string, string>>>): string[];
export declare function arrieresDesElements(elements: readonly {
    nature: NatureElementPaie;
    montantFc: number;
    enNature?: boolean;
}[]): number;
export declare function motifRefusMoisDeCessation(dateFin: Date | null, moisDeCessation: string): string | null;
export declare function motifRefusTypeContrat(typeRegistre: string, typeDeclare: string): string | null;
