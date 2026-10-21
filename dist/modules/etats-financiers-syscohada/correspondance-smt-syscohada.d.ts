export declare const DOCUMENTS_SMT_SYSCOHADA: readonly ["BILAN", "COMPTE_DE_RESULTAT", "NOTES_ANNEXES"];
export declare const INVENTAIRE_EXTRA_COMPTABLE_SMT: readonly ["le montant des créances et des dettes d'exploitation, dans le cas où les ventes et les achats ne sont pas totalement réglés", "le montant des stocks (produits finis, matières premières, consommables...) et des travaux en cours", "le montant des immobilisations acquises ou cédées au cours de l'exercice", "le montant des emprunts souscrits ou remboursés au cours de l'exercice"];
export declare const AMORTISSEMENT_SMT: {
    readonly mode: "LINEAIRE";
    readonly prorataTemporis: false;
};
export type SensSmtSyscohada = 'ACTIF' | 'PASSIF';
export type QualificatifSensSmtSyscohada = 'DEBITEUR' | 'CREDITEUR';
export interface PosteBilanSmtSyscohada {
    ref: string;
    libelle: string;
    sens: SensSmtSyscohada;
    note: string | null;
    comptes: string[];
    exclusions?: string[];
    sens_qualificatif?: QualificatifSensSmtSyscohada;
    comptesSansFiltreDeSens?: string[];
    fondement: string;
}
export declare const POSTES_BILAN_ACTIF_SMT_SYSCOHADA: PosteBilanSmtSyscohada[];
export declare const POSTES_BILAN_PASSIF_SMT_SYSCOHADA: PosteBilanSmtSyscohada[];
export declare const REF_RESULTAT_SMT_SYSCOHADA = "SP2";
export declare const LIBELLE_RESULTAT_SMT_SYSCOHADA = "R\u00E9sultat exercice";
export declare const COMPTES_RESULTAT_SMT_SYSCOHADA: string[];
export interface TotalSmtSyscohada {
    ref: string;
    libelle: string;
    deRefs: string[];
}
export declare const TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA: TotalSmtSyscohada[];
export declare const TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA: TotalSmtSyscohada[];
export declare const ORDRE_BILAN_ACTIF_SMT_SYSCOHADA: string[];
export declare const ORDRE_BILAN_PASSIF_SMT_SYSCOHADA: string[];
export declare const RENVOI_IMMOBILISATIONS_SMT_SYSCOHADA = "(1) \u00C0 faire figurer \u00E0 l'actif du bilan si elles correspondent \u00E0 des montants significatifs.";
export declare function trouvePosteBilanSmtSyscohada(ref: string): PosteBilanSmtSyscohada | undefined;
export declare const COMPTES_TRESORERIE_SMT_SYSCOHADA: string[];
export declare const COMPTES_DEPRECIATION_TRESORERIE_SMT_SYSCOHADA: string[];
export interface PosteFluxSmtSyscohada {
    ref: string;
    libelle: string;
    sens: 'RECETTE' | 'DEPENSE';
    note: string | null;
    comptes: string[];
    exclusions?: string[];
    fondement: string;
}
export declare const CONTREPARTIES_RESULTAT_SMT_SYSCOHADA: string[];
export declare const TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA: ReadonlyArray<{
    prefixe: string;
    cle: 'financement' | 'investissement';
}>;
export declare const EXCLUSIONS_CONTREPARTIES_RESULTAT_SMT_SYSCOHADA: string[];
export declare function dansPerimetreResultatSmt(numero: string): boolean;
export declare function estTiersHorsExploitationSmt(numero: string): boolean;
export declare const CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA: {
    cle: string;
    comptes: string[];
    intitule: string;
    fondement: string;
}[];
export declare const POSTES_RECETTES_SMT_SYSCOHADA: PosteFluxSmtSyscohada[];
export declare const POSTES_DEPENSES_SMT_SYSCOHADA: PosteFluxSmtSyscohada[];
export interface RetraitementSmtSyscohada {
    ref: string;
    libelle: string;
    note: string | null;
    signeOfficiel: 1 | -1;
    lettre: 'D' | 'E' | 'F';
    posteBilan: string | null;
    fondement: string;
}
export declare const DEFINITION_VARIATION_SMT_SYSCOHADA: "N1_MOINS_N";
export declare const RETRAITEMENTS_SMT_SYSCOHADA: RetraitementSmtSyscohada[];
export declare const COMPTES_DOTATIONS_SMT_SYSCOHADA: string[];
export declare const LETTRES_D_E_SMT_SYSCOHADA: {
    readonly D: readonly ["SV1", "SV2"];
    readonly E: readonly ["SV3"];
};
export interface TotalCompteResultatSmtSyscohada {
    ref: string;
    libelle: string;
    lettre: 'A' | 'B' | 'C' | 'G';
    deRefs: string[];
}
export declare const TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA: TotalCompteResultatSmtSyscohada[];
export declare const ORDRE_COMPTE_RESULTAT_SMT_SYSCOHADA: string[];
export interface ValeursResultatSmt {
    recettes: number;
    depenses: number;
    stocks: {
        n: number;
        n1: number;
    };
    creances: {
        n: number;
        n1: number;
    };
    dettes: {
        n: number;
        n1: number;
    };
    dotations: number;
}
export interface ResultatSmtCalcule {
    A: number;
    B: number;
    C: number;
    lignes: Record<'SV1' | 'SV2' | 'SV3' | 'SF', number>;
    D: number;
    E: number;
    F: number;
    G: number;
}
export declare function calculerResultatSmt(v: ValeursResultatSmt): ResultatSmtCalcule;
export interface SousTableauNoteSmtSyscohada {
    cle: string;
    intitule: string;
    colonnes: string[];
    ligneTotal: string;
}
export interface NoteSmtSyscohada {
    numero: number;
    intitule: string;
    partie: 'BILAN' | 'COMPTE_DE_RESULTAT';
    colonnes: string[] | null;
    sousTableaux?: SousTableauNoteSmtSyscohada[];
}
export declare const NOTES_SMT_SYSCOHADA: NoteSmtSyscohada[];
export declare const LIGNES_SYNTHESE_NOTE_2_SMT_SYSCOHADA: readonly ["VALEUR DU STOCK FINAL", "VALEUR DU STOCK INITIAL"];
export declare const JOURNAUX_DE_SUIVI_SMT_SYSCOHADA: readonly [{
    readonly cle: "creancesImpayees";
    readonly intitule: "Journal de suivi des créances impayées SMT";
    readonly colonnes: readonly ["Date", "N° facture", "Nom du client", "Montant", "Date paiement"];
}, {
    readonly cle: "dettesAPayer";
    readonly intitule: "Journal de suivi des dettes à payer SMT";
    readonly colonnes: readonly ["Date", "N° facture", "Nom du fournisseur", "Montant", "Date paiement"];
}];
export interface ColonneVentilationSmtSyscohada {
    cle: string;
    libelle: string;
    comptes: string[];
    exclusions?: string[];
    rajoutAutorise?: true;
}
export declare const VENTILATION_RECETTES_SMT_SYSCOHADA: ColonneVentilationSmtSyscohada[];
export declare const VENTILATION_DEPENSES_SMT_SYSCOHADA: ColonneVentilationSmtSyscohada[];
export declare const NB_JOURNAL_TRESORERIE_SMT_SYSCOHADA: string;
export interface SeuilSmtArt13 {
    cle: 'negoce' | 'artisanat' | 'services';
    categorie: string;
    montantFcfa: number;
}
export declare const SEUILS_SMT_ART13_FCFA: SeuilSmtArt13[];
export declare const CLAUSE_EQUIVALENT_ART13 = "ou l'\u00E9quivalent dans l'unit\u00E9 mon\u00E9taire ayant cours l\u00E9gal dans l'\u00C9tat partie";
export declare const COMPTES_CHIFFRE_AFFAIRES_ART13: readonly string[];
