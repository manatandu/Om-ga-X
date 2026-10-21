export type MethodeConsolidation = 'IG' | 'IP' | 'ME' | 'NC' | 'EXCLUE';
export type NatureControle = 'EXCLUSIF_DE_DROIT' | 'EXCLUSIF_DE_FAIT' | 'EXCLUSIF_CONTRACTUEL' | 'CONJOINT' | 'INFLUENCE_NOTABLE' | 'AUCUN';
export type MotifExclusion = 'PERTE_CONTROLE_DEMONTREE' | 'RESTRICTIONS_SEVERES_DURABLES' | 'DETENUE_EN_VUE_DE_CESSION' | 'INFORMATION_FRAIS_EXCESSIFS' | 'IMPORTANCE_NEGLIGEABLE';
export declare const LIBELLE_MOTIF_EXCLUSION: Record<MotifExclusion, string>;
export interface EntitePerimetre {
    id: string;
    nom: string;
    estConsolidante: boolean;
    designationMajoriteDeuxExercices?: boolean;
    aucunAutreAssocieSuperieur?: boolean;
    controleContractuel?: boolean;
    accordControleConjoint?: boolean;
    influenceNotableDeclaree?: boolean;
    exclusion?: {
        motif: MotifExclusion;
        justification: string;
    } | null;
    dateCloture?: Date | null;
}
export interface LienParticipation {
    detentriceId: string;
    detenueId: string;
    pctDroitsVote: number;
    pctCapital: number;
}
export interface ResultatEntite {
    id: string;
    nom: string;
    estConsolidante: boolean;
    pctControle: number;
    pctInteret: number;
    natureControle: NatureControle;
    methode: MethodeConsolidation;
    fondement: string;
    aJustifierEnNotes: string[];
    exclusion: {
        motif: MotifExclusion;
        libelle: string;
        justification: string;
    } | null;
    dateCloture: DateClotureVerdict | null;
}
export interface DateClotureVerdict {
    ecartMois: number;
    verdict: 'MEME_DATE' | 'DEROGATION_POSSIBLE' | 'ETATS_SUPPLEMENTAIRES';
    message: string;
}
export declare const SEUIL_CONTROLE_DE_DROIT = 50;
export declare const SEUIL_PRESOMPTION_CONTROLE_DE_FAIT = 40;
export declare const SEUIL_PRESOMPTION_INFLUENCE_NOTABLE = 20;
export declare function analyserPerimetre(entites: EntitePerimetre[], liens: LienParticipation[]): ResultatEntite[];
export declare function verdictDateCloture(mere: Date, filiale: Date): DateClotureVerdict;
export interface FaitsObligation {
    sousControleEntiteOhadaConsolidante?: boolean;
    siegesDansDeuxRegions?: boolean;
    appelPublicEpargne?: boolean;
    demandeAssociesDixieme?: boolean;
    chiffreAffairesN?: number | null;
    chiffreAffairesN1?: number | null;
    seuilEquivalentFc?: number | null;
    sourceSeuil?: string | null;
}
export interface VerdictObligation {
    obligation: 'OBLIGATOIRE' | 'DISPENSEE' | 'NON_REQUISE' | 'A_EXAMINER';
    motifs: string[];
    normesIfrsRequises: boolean;
}
export declare const SEUIL_DISPENSE_FCFA = 500000000;
export declare function verdictObligation(resultats: ResultatEntite[], faits: FaitsObligation): VerdictObligation;
