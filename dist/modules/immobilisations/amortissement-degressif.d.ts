export declare const CATEGORIES_ARTICLE_31: readonly [{
    readonly cle: "MATERIEL_INDUSTRIEL";
    readonly libelle: "Matériels et outillages utilisés pour des opérations industrielles de fabrication, de transformation, d'extraction ou de transport, à l'exclusion des véhicules de tourisme";
}, {
    readonly cle: "MANUTENTION_LEVAGE";
    readonly libelle: "Matériels de manutention ou de levage, à l’exclusion des chariots métalliques mis à la disposition des clients des magasins";
}, {
    readonly cle: "INSTALLATIONS_ENERGIE";
    readonly libelle: "Installations productrices de vapeur, chaleur, énergie et froid industriel";
}, {
    readonly cle: "INSTALLATIONS_SECURITE";
    readonly libelle: "Installations de sécurité";
}, {
    readonly cle: "MEDICO_SOCIAL";
    readonly libelle: "Installations à caractère médico-social, à l’exclusion des installations purement sociales, d’ordre sportif ou uniquement consacrées à l’organisation des loisirs";
}, {
    readonly cle: "MACHINES_DE_BUREAU";
    readonly libelle: "Machines de bureau, à l’exclusion de tout autre matériel et du mobilier de bureau";
}, {
    readonly cle: "RECHERCHE";
    readonly libelle: "Matériel et outillage utilisés à des opérations de recherche scientifique ou technique";
}, {
    readonly cle: "MAGASINAGE_STOCKAGE";
    readonly libelle: "Installations de magasinage et de stockage, à l’exclusion des locaux servant à l’exercice de la profession";
}, {
    readonly cle: "HOTELLERIE";
    readonly libelle: "Immeubles et matériels des entreprises hôtelières, à l’exclusion des biens d’équipement des entreprises exerçant uniquement l’activité de restaurateur ou de cafetier";
}, {
    readonly cle: "AGRICULTURE_ELEVAGE";
    readonly libelle: "Machines agricoles et installations d’élevage, à l’exception des bâtiments et des terrains";
}];
export type CategorieDegressif = (typeof CATEGORIES_ARTICLE_31)[number]['cle'];
export declare function coefficientDegressif(dureeFiscaleAns: number): number | null;
export declare function motifRegimeAnterieurDegressif(dateMiseEnService: Date | null | undefined): string | null;
export declare function avertissementsDureeFiscale(o: {
    natureFiscaleCle: string | null | undefined;
    dureeFiscaleAns: number | null | undefined;
}): string[];
export declare const SEUIL_PRORATA_EXPORT_ARTICLE_36 = 0.2;
export type DeclarationExceptionnel = {
    activiteIndustrielle: boolean | undefined;
    chiffreAffairesExportHt: number | null | undefined;
    chiffreAffairesTotalHt: number | null | undefined;
    source: string | null | undefined;
};
export declare function prorataExport(d: {
    chiffreAffairesExportHt: number;
    chiffreAffairesTotalHt: number;
}): number;
export declare function motifRefusDeclarationExceptionnel(d: DeclarationExceptionnel): string | null;
export declare function motifRefusOptionDegressif(o: {
    referentiel: string;
    personnePhysique: boolean;
    numeroCompteImmobilisation: string;
    categorie: string | null | undefined;
    bienNeuf: boolean | undefined;
    dureeFiscaleAns: number | null | undefined;
    amortissementAnterieur: number;
    dotationsPassees: number;
    dateMiseEnService: Date | null;
    exceptionnel?: DeclarationExceptionnel | null;
}): string | null;
export type LignePlanFiscal = {
    exerciceId: string;
    valeurResiduelleDebut: number;
    annuite: number;
    mode: 'DEGRESSIF' | 'LINEAIRE_ART_35' | 'EXCEPTIONNEL_ART_38';
};
export declare const TAUX_PREMIERE_ANNUITE_EXCEPTIONNELLE = 0.6;
export declare function planFiscalDegressif(p: {
    base: number;
    dureeFiscaleAns: number;
    dateMiseEnService: Date | null;
    exercices: readonly {
        id: string;
        dateDebut: Date;
        dateFin: Date;
    }[];
    exceptionnel?: boolean;
}): LignePlanFiscal[];
export declare function derogatoireDeLExercice(annuiteFiscale: number, dotationComptable: number, cumulAnterieur: number): {
    dotation: number;
    reprise: number;
    excedentAReintegrer: number;
};
export declare const COMPTES_DEROGATOIRE: {
    readonly amortissementsDerogatoires: "15100000";
    readonly dotationsHao: "85100000";
    readonly reprisesHao: "86100000";
};
