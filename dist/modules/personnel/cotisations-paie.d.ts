import { type Annexe } from './bareme-smig';
import { type DecimalExact } from '../../common/decimal-exact';
export type ChargeCotisation = 'EMPLOYEUR' | 'TRAVAILLEUR';
export type NatureEmployeurInpp = 'PUBLIC' | 'PRIVE';
export type LigneCotisation = {
    readonly cle: string;
    readonly libelle: string;
    readonly organisme: 'CNSS' | 'INPP' | 'ONEM';
    readonly charge: ChargeCotisation;
    readonly tauxPourCent: number;
    readonly assietteFc: number;
    readonly montantFc: number;
    readonly source: string;
    readonly reserve: string | null;
};
export declare const TAUX_CNSS: {
    readonly prestationsAuxFamilles: {
        readonly tauxPourCent: 6.5;
        readonly charge: ChargeCotisation;
        readonly article: "article 2";
    };
    readonly pensionsEmployeur: {
        readonly tauxPourCent: 5;
        readonly charge: ChargeCotisation;
        readonly article: "article 3";
    };
    readonly pensionsTravailleur: {
        readonly tauxPourCent: 5;
        readonly charge: ChargeCotisation;
        readonly article: "article 3";
    };
    readonly risquesProfessionnels: {
        readonly tauxPourCent: 1.5;
        readonly charge: ChargeCotisation;
        readonly article: "article 4";
    };
};
export declare const MAJORATION_RISQUES_PROFESSIONNELS_MAXIMUM = 2;
export declare const MAJORATIONS_RISQUES_PROFESSIONNELS_POUR_CENT: readonly [50, 100];
export type MajorationRisquesProfessionnels = (typeof MAJORATIONS_RISQUES_PROFESSIONNELS_POUR_CENT)[number];
export declare function reserveMajorationRisquesProfessionnels(pourCent: MajorationRisquesProfessionnels): string;
export type RegimeCnss = 'TRAVAILLEUR' | 'APPRENTI';
export declare const NON_DUES_APPRENTI = "CNSS \u00B7 prestations aux familles et pensions NON DUES \u00B7 l'apprenti n'est assujetti qu'\u00E0 la branche des risques professionnels (loi n\u00B0 16/009, art. 4, 1\u00B0 ; arr\u00EAt\u00E9 n\u00B0 139/2018, art. 1er, 1\u00B0), aucune quote-part ouvri\u00E8re n'est retenue.";
export declare const RESERVE_ASSIETTE_ASSIMILE = "Apprenti \u00B7 travailleur assimil\u00E9, la cotisation est \u00E0 la charge du ma\u00EEtre (arr\u00EAt\u00E9 n\u00B0 139/2018, art. 4, 1\u00B0). Pour les assimil\u00E9s, \u00AB les cotisations peuvent \u00EAtre assises sur les revenus fix\u00E9s par le Conseil d'administration \u00BB de la Caisse (loi n\u00B0 16/009, art. 13, al. 2) \u00B7 cette d\u00E9cision n'est pas au corpus, OmegaX garde l'assiette de l'article 7 et le dit.";
export declare const RESERVE_REGIME_CNSS_INCONNU = "CNSS \u00B7 calcul valable pour un travailleur assujetti \u00E0 toutes les branches (loi n\u00B0 16/009, art. 3). Le contrat du mois n'est pas lu \u00B7 un apprenti ne cotise qu'aux risques professionnels (art. 4).";
export type BaremeInpp = {
    readonly aPartirDu: string;
    readonly reference: string;
    readonly publicPourCent: number;
    readonly priveParTranche: readonly {
        readonly jusqua: number | null;
        readonly tauxPourCent: number;
    }[];
};
export declare const BAREMES_INPP: readonly BaremeInpp[];
export declare const BAREMES_ONEM: readonly {
    aPartirDu: string;
    tauxPourCent: number;
    reference: string;
}[];
export declare const RESERVE_ASSIETTE_INPP = "Assiette \u00B7 la cotisation na\u00EEt de l'article 15 b) du Code du travail, qui ne d\u00E9l\u00E8gue que le taux \u00E0 l'arr\u00EAt\u00E9 ; \u00AB r\u00E9mun\u00E9ration \u00BB s'y lit au sens de l'article 7 du m\u00EAme Code. PAIEMENT \u00B7 la cotisation est trimestrielle et se verse au plus tard le 30 avril, le 31 juillet, le 31 octobre et le 31 janvier (ordonnance n\u00B0 84/186 du 15 octobre 1984, art. 1er et 3). P\u00C9RIODE DE L'ASSIETTE \u00B7 l'article 15 b) dit \u00AB la cotisation mensuelle des employeurs proportionnelle \u00E0 la somme des r\u00E9mun\u00E9rations vers\u00E9es par eux \u00E0 leur personnel au cours du trimestre pr\u00E9c\u00E9dent \u00BB. La paie calcule chaque mois la cotisation sur les r\u00E9mun\u00E9rations vers\u00E9es dans le mois, et tient la somme des trois mois pour la cotisation du trimestre pay\u00E9e \u00E0 l'\u00E9ch\u00E9ance \u00B7 c'est une LECTURE, qu'aucun texte n'\u00E9crit. L'autre lecture prend pour assiette les r\u00E9mun\u00E9rations du trimestre pr\u00E9c\u00E9dent, ce qui d\u00E9cale la cotisation d'un trimestre ; si c'est la v\u00F4tre, le montant de ce mois ne vaut pas. Aucun texte ne dit \u00E0 quelle date se lit l'effectif d'un employeur priv\u00E9 dont la tranche change en cours de trimestre \u00B7 la paie retient l'effectif d\u00E9clar\u00E9 pour le mois.";
export declare const reserveBaremeInppAuMois: (moisDePaie: string, aPartirDu: string) => string;
export declare const RESERVE_ONEM_ARTICLE_6 = "ONEM, ARR\u00CAT\u00C9 n\u00B0 028/2025, art. 6 \u00B7 \u00AB Les contributions non acquitt\u00E9es \u00E0 la date d'entr\u00E9e en vigueur du pr\u00E9sent Arr\u00EAt\u00E9 ainsi que les p\u00E9nalit\u00E9s y applicables sont calcul\u00E9es conform\u00E9ment au taux fix\u00E9 aux articles 1er et 3, alin\u00E9a 2. \u00BB Si la contribution de ce mois n'\u00E9tait pas acquitt\u00E9e le 25 septembre 2025, elle se calcule \u00E0 0,5 %, et ses p\u00E9nalit\u00E9s au nouveau taux \u00B7 le taux rendu ici est celui du mois de paie.";
export declare function tauxInpp(moisDePaie: string, nature: NatureEmployeurInpp, effectif: number | null, versionsDossier?: readonly BaremeInpp[], dateVersement?: string | null): {
    tauxPourCent: number | null;
    source: string;
    motifAbstention: string | null;
    saisieCabinet?: boolean;
};
export declare function tauxOnem(moisDePaie: string, versionsDossier?: VersionsDuDossier['onem']): {
    tauxPourCent: number | null;
    source: string;
    saisieCabinet?: boolean;
};
export type TauxCnssVersion = {
    readonly aPartirDu: string;
    readonly reference: string;
    readonly prestationsAuxFamilles: number | null;
    readonly pensionsEmployeur: number;
    readonly pensionsTravailleur: number;
    readonly risquesProfessionnels: number;
};
export declare const BAREMES_CNSS: readonly TauxCnssVersion[];
export declare const ABSTENTION_CNSS_TRANSITOIRE = "CNSS \u00B7 prestations aux familles, novembre et d\u00E9cembre 2018 \u00B7 le r\u00E9gime transitoire de l'article 10 du d\u00E9cret n\u00B0 18/041 ne fixe ce taux que pour l'ex-province du Katanga (4 % \u00E0 charge de l'employeur) ; ailleurs le taux ant\u00E9rieur n'est pas au corpus, et OmegaX ne conna\u00EEt pas la province du dossier.";
export declare function tauxCnss(moisDePaie: string, versionsDossier?: readonly VersionCnss[]): (TauxCnssVersion & {
    saisieCabinet?: boolean;
}) | null;
export type VersionCnss = {
    readonly aPartirDu: string;
    readonly reference: string;
    readonly prestationsAuxFamilles: number;
    readonly pensionsEmployeur: number;
    readonly pensionsTravailleur: number;
    readonly risquesProfessionnels: number;
};
export type VersionsDuDossier = {
    readonly cnss: readonly VersionCnss[];
    readonly inpp: readonly BaremeInpp[];
    readonly onem: readonly {
        aPartirDu: string;
        tauxPourCent: number;
        reference: string;
    }[];
};
export declare const RESERVE_BAREME_CABINET = "BAR\u00C8ME SAISI PAR LE CABINET \u00B7 OmegaX n'a pas lu ce texte. Le taux et sa r\u00E9f\u00E9rence sont ceux que le cabinet a d\u00E9clar\u00E9s, et c'est \u00E0 lui d'en r\u00E9pondre.";
export type ParametresCotisations = {
    readonly moisDePaie: string;
    readonly joursPayes?: number | null;
    readonly dateMiseADisposition?: string | null;
    readonly annexesSmig?: readonly Annexe[];
    readonly versionsDossier?: VersionsDuDossier;
    readonly natureEmployeurInpp?: NatureEmployeurInpp | null;
    readonly effectif?: number | null;
    readonly reductionTauxInppPoints?: number | null;
    readonly referenceReductionInpp?: string | null;
    readonly majorationRisquesProfessionnelsPourCent?: MajorationRisquesProfessionnels | null;
    readonly regimeCnss?: RegimeCnss | null;
};
export type VerdictCotisations = {
    readonly lignes: readonly LigneCotisation[];
    readonly totalEmployeurFc: number;
    readonly totalTravailleurFc: number;
    readonly coutEmployeurSupplementaireFc: number;
    readonly abstentions: readonly string[];
    readonly quotePartOuvriereNonChiffree: string | null;
    readonly plancherCnss?: PlancherCnss;
    readonly reserves?: readonly string[];
};
export type PlancherCnss = {
    readonly baseFc: number | null;
    readonly plancherFc: number | null;
    readonly applique: boolean;
    readonly message: string | null;
};
export declare function plancherCnss(moisDePaie: string, assietteSocialeFc: number, joursPayes?: number | null, annexesSmig?: readonly Annexe[]): PlancherCnss;
export declare function cotisations(assietteSocialeFc: number, parametres: ParametresCotisations): VerdictCotisations;
export declare function cotisationsExactes(assietteSociale: DecimalExact, parametres: ParametresCotisations): {
    verdict: VerdictCotisations;
    totalTravailleurExact: DecimalExact;
};
export declare const RESERVE_SAISIES_ET_CESSIONS: string;
export type VerdictNet = {
    readonly totalVerseFc: number;
    readonly quotePartOuvriereFc: number | null;
    readonly irppFc: number | null;
    readonly netAPayerFc: number | null;
    readonly reserves: readonly string[];
};
export declare function netAPayer(totalVerseFc: number, quotePartOuvriereFc: number | null, irppFc: number | null, retenuesAvancesFc?: number): VerdictNet;
export declare function netAPayerExact(totalVerse: DecimalExact, quotePartOuvriere: DecimalExact | null, irppFc: number | null, retenuesAvances?: DecimalExact): {
    verdict: VerdictNet;
    netExact: DecimalExact | null;
};
export declare function netNegatifAuCentime(net: DecimalExact): boolean;
