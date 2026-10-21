export declare const EFFECTIF_LIVRE_INSPIRE = 25;
export declare const EFFECTIF_LIVRE_INSPIRE_ARRETE = 10;
export declare const RESERVE_CONTRADICTION_DE_SEUIL: string;
export declare const DOUBLES_DETACHABLES_MINIMUM = 2;
export declare const ARRETE_DU_MODELE: {
    readonly reference: "Arrêté ministériel n° 12/CAB.MIN/ETPS/042 du 8 août 2008";
    readonly objet: "fixant le modèle de livre de paie et de décompte écrit de la rémunération";
    readonly publie: "Journal officiel de la République Démocratique du Congo, première partie, 49ème année, n° 16, 15 août 2008";
    readonly signataire: "Marie Ange Lukiana Mufwankolo";
    readonly viseParLeCodeDuTravail: readonly ["article 103", "article 214", "article 215"];
    readonly abroge: "Arrêté ministériel n° 17/67 du 3 octobre 1967";
    readonly avisDuConseilNationalDuTravail: "troisième session extraordinaire, 25 mars au 8 avril 2008";
    readonly lu: true;
    readonly pourquoi: string;
};
export type MentionFeuilleDePaie = {
    readonly rang: number;
    readonly libelle: string;
};
export declare const MENTIONS_ARTICLE_25: readonly MentionFeuilleDePaie[];
export declare const MENTIONS_MODELE_2008: readonly MentionFeuilleDePaie[];
export declare const FORMULES_DU_MODELE: {
    readonly brut: {
        readonly rang: 20;
        readonly composantes: readonly [7, 10, 11, 12, 13, 16, 19];
    };
    readonly totalDesDeductions: {
        readonly rang: 26;
        readonly composantes: readonly [21, 22, 23, 24, 25];
    };
    readonly joursDAllocationsFamiliales: {
        readonly rang: 28;
        readonly composantes: readonly [6, 14, 17];
    };
};
export declare const DESTINATION_DES_DOUBLES: {
    readonly premier: "au TRAVAILLEUR, à chaque paie · c'est le bulletin de paie écrit de la rémunération payée, « constitué par un des doubles du livre de paie prévus à l'article 214 du Code du Travail »";
    readonly second: "à la CNSS, selon la réglementation en vigueur";
};
export declare const TEXTE_ARTICLE_2_SECOND_DOUBLE = "Arr\u00EAt\u00E9 n\u00B0 12/CAB.MIN/ETPS/042 du 8 ao\u00FBt 2008, art. 2 : \u00AB Le second double est \u00E0 remettre \u00E0 l'Institut National de S\u00E9curit\u00E9 Sociale, selon la r\u00E9glementation en vigueur. \u00BB L'Institut est devenu la Caisse nationale de s\u00E9curit\u00E9 sociale par le d\u00E9cret n\u00B0 18/027 du 14 juillet 2018.";
export declare const REFERENCE_ARRETE_142_2018 = "Arr\u00EAt\u00E9 minist\u00E9riel n\u00B0 142/2018 d\u00E9terminant les modalit\u00E9s d'application du mois d'assurance, art. 10 et 12";
export declare const MENTIONS_ARRETE_142_2018: readonly MentionFeuilleDePaie[];
export declare const ECARTS_2008_2018: readonly {
    rangs: string;
    ecart: string;
}[];
export declare const DECOMPTE_A_LA_RUPTURE: string;
export declare const EXIGENCE_INALTERABILITE: string;
export declare const SANCTION_ARTICLE_328: string;
export declare const RESERVE_MISE_EN_FORME: string;
export type MotifRefusLivre = 'MISE_EN_FORME_NON_VERIFIABLE' | 'AUTORISATION_INSPECTEUR_ABSENTE' | 'SIEGE_DEXPLOITATION_NON_DESIGNE' | 'ENONCIATIONS_INCOMPLETES';
export type FormeDuDocument = 'LIVRE_PAPIER' | 'FICHIER_INFORMATISE' | 'AUTRE_DOCUMENT';
export type EntreeLivreDePaie = {
    readonly siegeDExploitation?: string | null;
    readonly formeDuDocument?: FormeDuDocument | null;
    readonly autorisationInspecteurDuTravail?: boolean | null;
    readonly effectifHabituel?: number | null;
    readonly mentionsPortees?: readonly number[];
    readonly exclusivementPersonnelDomestique?: boolean;
};
export type VerdictLivreDePaie = {
    readonly livreDu: boolean;
    readonly remplacementAutorise: boolean;
    readonly enonciationsCompletes: boolean;
    readonly livreInspireAdmis: boolean;
    readonly mentionsPorteesCount: number;
    readonly mentionsManquantes: readonly MentionFeuilleDePaie[];
    readonly conformiteAuModeleCertifiee: false;
    readonly refus: readonly {
        motif: MotifRefusLivre;
        explication: string;
    }[];
    readonly reserves: readonly string[];
};
export declare function livreDePaie(entree: EntreeLivreDePaie): VerdictLivreDePaie;
export declare const SANCTION_ARTICLE_103: string;
export declare const RESERVE_ARTICLE_104: string;
