import { type DecimalExact } from '../../common/decimal-exact';
export declare const PREMIER_EXERCICE_IRPP = 2026;
export declare const LOI_IRPP: {
    readonly reference: "Loi n° 23/053 du 30 novembre 2023";
    readonly articleBareme: "article 118";
    readonly entreeEnVigueur: "2026-01-01";
    readonly regimeAnterieur: "OmegaX ne calcule pas l'impôt sur les rémunérations avant cette date.";
};
export type TrancheIrpp = {
    readonly jusqua: number | null;
    readonly tauxPourCent: number;
};
export declare const TRANCHES_IRPP: readonly TrancheIrpp[];
export declare const PLAFOND_IMPOT_POUR_CENT = 30;
export declare const QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT = 2;
export declare const MAXIMUM_PERSONNES_A_CHARGE = 9;
export declare const PAS_D_ARRONDI_ASSIETTE_FC = 1000;
export declare const arrondirAuMillierInferieur: (montantFc: number | DecimalExact) => number;
export declare const SEUIL_OU_LE_PLAFOND_MORD = 77932800;
export declare const BORNE_TROISIEME_TRANCHE = 43200000;
export type DetailTranche = {
    readonly tauxPourCent: number;
    readonly baseFc: number;
    readonly impotFc: number;
};
export declare function impotDuBareme(assietteArrondieFc: number): {
    impotFc: number;
    parTranche: readonly DetailTranche[];
};
export declare const IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC: number;
export declare const TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT: number;
export type VerdictIrpp = {
    readonly assietteArrondieFc: number;
    readonly impotDuBaremeFc: number;
    readonly parTranche: readonly DetailTranche[];
    readonly plafondFc: number;
    readonly plafondApplique: boolean;
    readonly impotArticle118Fc: number;
    readonly personnesACharge: number;
    readonly personnesAChargeRetenues: number;
    readonly baseDeLaQuotiteFc: number;
    readonly quotitePourCent: number;
    readonly reductionFc: number;
    readonly impotDuFc: number;
    readonly reserves: readonly string[];
};
export declare function impotAnnuel(revenuNetGlobalFc: number | DecimalExact, personnesACharge?: number): VerdictIrpp;
export declare const MOIS_PAR_AN = 12;
export type TrancheMensuelle = {
    readonly tauxPourCent: number;
    readonly deFc: number;
    readonly aFc: number | null;
};
export declare const TRANCHES_IRPP_MENSUELLES: readonly TrancheMensuelle[];
export type DetailMensuel = {
    readonly revenuRetenuFc: number;
    readonly parTranche: readonly (TrancheMensuelle & {
        baseFc: number;
        impotFc: number;
    })[];
    readonly impotDuBaremeFc: number;
    readonly plafondFc: number;
    readonly plafondApplique: boolean;
    readonly impotArticle118Fc: number;
    readonly quotitePourCent: number;
    readonly reductionFc: number;
    readonly retenueAvantArrondiFc: number;
    readonly arrondiArticle150Fc: number;
    readonly retenueFc: number;
};
export declare function detailMensuel(annuel: VerdictIrpp): DetailMensuel;
export type VerdictRetenueMensuelle = {
    readonly moisDePaie: string;
    readonly revenuImposableDuMoisFc: number;
    readonly revenuAnnualiseFc: number;
    readonly annuel: VerdictIrpp;
    readonly mensuel: DetailMensuel;
    readonly retenueFc: number;
    readonly reserves: readonly string[];
};
export declare function retenueMensuelle(moisDePaie: string, revenuImposableDuMoisFc: number | DecimalExact, personnesACharge?: number): VerdictRetenueMensuelle;
export type RegimeSalarial = 'BAREME_ARTICLE_118' | 'FORFAIT_PERSONNEL_DOMESTIQUE' | 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE';
export declare const FORFAITS_ARRETE_019_2025 = "L'arr\u00EAt\u00E9 minist\u00E9riel n\u00B0 019/CAB/MIN/FINANCES/2025 du 19 f\u00E9vrier 2025, en vigueur depuis le 1er janvier 2026, fixe ces forfaits ANNUELS \u00E0 l'\u00E9quivalent en francs congolais de 24 dollars par salari\u00E9 domestique et de 36 dollars par salari\u00E9 de micro-entreprise, retenus \u00E0 la source par l'employeur et revers\u00E9s par quotit\u00E9 trimestrielle (6 et 9 dollars) au plus tard le 15 du mois qui suit la fin de chaque trimestre, tout trimestre commenc\u00E9 \u00E9tant d\u00FB en entier (art. 2). Le cours de conversion est renvoy\u00E9 \u00E0 la circulaire sur les canaux digitaux, absente du corpus \u00B7 OmegaX ne chiffre donc aucune quotit\u00E9 en francs.";
export declare const REGIMES_SALARIAUX: Readonly<Record<RegimeSalarial, string>>;
export declare const RESERVE_REGIME_NON_DECLARE = "R\u00C9GIME NON D\u00C9CLAR\u00C9 \u00B7 le bar\u00E8me de droit commun de l'article 118 est retenu. Un personnel domestique ou un salari\u00E9 de micro-entreprise rel\u00E8ve d'une retenue forfaitaire lib\u00E9ratoire (art. 121, alin\u00E9a 2), que OmegaX ne chiffre pas \u00B7 le d\u00E9clarer abstient la retenue.";
export declare function regimeApplicable(regime: RegimeSalarial): {
    calculable: boolean;
    motif: string;
};
export declare function baremeApplicableAuMois(moisDePaie: string): {
    applicable: boolean;
    motif: string | null;
};
