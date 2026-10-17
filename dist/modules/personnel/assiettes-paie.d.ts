import { type DecimalExact } from '../../common/decimal-exact';
export type NatureElementPaie = 'SALAIRE_OU_TRAITEMENT' | 'COMMISSION' | 'INDEMNITE_DE_VIE_CHERE' | 'PRIME' | 'PARTICIPATION_AUX_BENEFICES' | 'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE' | 'PRESTATION_SUPPLEMENTAIRE' | 'AVANTAGE_EN_NATURE' | 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE' | 'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT' | 'INDEMNITE_DE_FIN_DE_CONTRAT' | 'SOINS_DE_SANTE' | 'LOGEMENT_OU_SON_INDEMNITE' | 'ALLOCATIONS_FAMILIALES_LEGALES' | 'INDEMNITE_DE_TRANSPORT' | 'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION';
export declare const HORS_REMUNERATION_ARTICLE_7: readonly NatureElementPaie[];
export type FormeImmunite = 'PLAFOND' | 'CONDITION' | 'TOTALE';
export type ImmuniteArticle69 = {
    readonly nature: NatureElementPaie;
    readonly point: string;
    readonly forme: FormeImmunite;
    readonly texte: string;
    readonly conditionNonVerifiableParLeLogiciel: boolean;
};
export declare const IMMUNITES_ARTICLE_69: readonly ImmuniteArticle69[];
export declare const PLAFOND_LOGEMENT_POUR_CENT = 30;
export declare const RESOLUTION_TAUX_LEGAL_ALLOCATIONS: string;
export type ElementPaie = {
    readonly nature: NatureElementPaie;
    readonly libelle: string;
    readonly montantFc: number;
    readonly remboursementDeDepenseProfessionnelleEffective?: boolean;
    readonly conditionArticle69Attestee?: boolean | null;
    readonly enNature?: boolean;
};
export declare const NATURES_FOURNIES_EN_NATURE: readonly NatureElementPaie[];
export type ElementHorsRemuneration = {
    readonly libelle: string;
    readonly montantFc: number;
    readonly motif: string;
};
export type SortFiscal = {
    readonly libelle: string;
    readonly montantFc: number;
    readonly imposableFc: number | null;
    readonly motif: string;
};
export type MotifAbstentionFiscale = 'CONDITION_ARTICLE_69_NON_ATTESTEE' | 'TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI';
export type Abstention = {
    readonly motif: MotifAbstentionFiscale;
    readonly libelle: string;
    readonly montantFc: number;
    readonly explication: string;
};
export type VerdictAssiettes = {
    readonly assietteSocialeFc: number;
    readonly horsRemuneration: readonly ElementHorsRemuneration[];
    readonly assietteFiscaleBruteFc: number | null;
    readonly sortsFiscaux: readonly SortFiscal[];
    readonly retenuesArticle71Fc: number;
    readonly assietteFiscaleNetteFc: number | null;
    readonly motifAssietteNetteNonChiffree: string | null;
    readonly abstentions: readonly Abstention[];
    readonly reserves: readonly string[];
};
export type TauxLegalNonCalcule = {
    readonly cause: 'ENFANTS_BENEFICIAIRES_NON_RENSEIGNES';
} | {
    readonly cause: 'MOIS_SANS_GRILLE_DU_SMIG';
    readonly raison: string;
};
export type ParametresAssiettes = {
    readonly tauxLegalAllocationsFamilialesFc?: number | null;
    readonly tauxLegalAllocationsNonCalcule?: TauxLegalNonCalcule | null;
    readonly retenuesArticle71Fc?: number;
    readonly quotePartOuvriereNonChiffree?: string | null;
};
export declare function explicationTauxLegalNonChiffre(immunite: Pick<ImmuniteArticle69, 'point' | 'texte'>, nonCalcule: TauxLegalNonCalcule | null): string;
export declare function assietteSociale(elements: readonly ElementPaie[]): {
    montantFc: number;
    horsRemuneration: readonly ElementHorsRemuneration[];
};
export declare function assiettes(elements: readonly ElementPaie[], parametres?: ParametresAssiettes): VerdictAssiettes;
export type ParametresAssiettesExactes = Omit<ParametresAssiettes, 'retenuesArticle71Fc'> & {
    readonly retenuesArticle71?: DecimalExact;
};
export type AssiettesExactes = {
    readonly verdict: VerdictAssiettes;
    readonly socialeExacte: DecimalExact;
    readonly netteExacte: DecimalExact | null;
};
export declare function assiettesExactes(elements: readonly ElementPaie[], parametres?: ParametresAssiettesExactes): AssiettesExactes;
