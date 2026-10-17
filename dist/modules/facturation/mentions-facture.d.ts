export declare const AMENDE_PAR_OMISSION: {
    readonly personneMorale: 750000;
    readonly personnePhysique: 250000;
    readonly source: "Loi de procédures fiscales, art. 97 bis (créé par l’O.-L. n° 13/005 du 23 février 2013)";
    readonly reserve: string;
};
export declare const HOMOLOGATION: {
    readonly omegaxHomologue: false;
    readonly source: "Décret n° 23/10 du 3 mars 2023, art. 3 (7°), 20, 21, 22 et 23";
    readonly qualification: string;
    readonly procedure: string;
    readonly consequence: string;
    readonly qualificationHypothetique: string;
};
export declare const OBLIGATION_DACCEPTATION: {
    readonly source: "Décret n° 23/10 du 3 mars 2023, art. 25 et 27";
    readonly mention: string;
    readonly supportsDeDeduction: readonly [{
        readonly cas: "de façon générale";
        readonly support: "une facture normalisée ou tout autre document en tenant lieu dûment délivré par un assujetti";
        readonly tenuParOmegaX: true;
    }, {
        readonly cas: "en cas d’importation";
        readonly support: "la déclaration de mise à la consommation délivrée par la douane";
        readonly tenuParOmegaX: false;
    }, {
        readonly cas: "en cas de livraison de biens ou de prestation de services à soi-même";
        readonly support: "une facture normalisée à soi-même";
        readonly tenuParOmegaX: false;
    }];
    readonly reserveSupports: string;
};
export interface FactureVerifiable {
    emetteurNom: string | null;
    emetteurAdresse: string | null;
    emetteurNumeroImpot: string | null;
    contrepartieNom: string | null;
    contrepartieAdresse: string | null;
    contrepartieNumeroImpot: string | null;
    dateFacture: Date | null;
    numeroSerie: string | null;
    mentionTvaDebits: boolean;
    autresImpotsEtTaxes: number | null;
    lignes: readonly LigneVerifiable[];
}
export interface LigneVerifiable {
    designation: string | null;
    quantite: number | null;
    prixUnitaire: number | null;
    montantHT: number | null;
    imposable: boolean;
    tauxApplique: number | null;
    montantTva: number | null;
}
export type CleMention = 'IDENTITE_VENDEUR' | 'IDENTITE_CLIENT' | 'DATE_ET_NUMERO' | 'DESIGNATION_ET_QUANTITE' | 'PRIX_UNITAIRE_ET_GLOBAL' | 'PRIX_HORS_TVA' | 'TAUX_ET_MONTANT_TVA' | 'MONTANT_NON_TAXABLE' | 'MONTANT_TTC' | 'AUTRES_IMPOTS_ET_TAXES' | 'NUMERO_DISPOSITIF_ELECTRONIQUE' | 'CODE_AUTHENTIFICATION_ET_QR';
export interface Mention {
    cle: CleMention;
    libelle: string;
    presente: (f: FactureVerifiable) => boolean;
    exigeUnDispositifElectronique?: true;
}
export declare const MENTIONS_ARTICLE_26: readonly Mention[];
export declare const MENTIONS_DOCUMENT_EN_TENANT_LIEU: Mention[];
export declare const ENTREE_EN_VIGUEUR_DECRET_23_10: Date;
export declare const MENTIONS_ARTICLE_100: readonly Mention[];
export declare const EXCLUSION_DEDUCTION_ART_104: {
    readonly article: "décret n° 011/42, art. 104";
    readonly citation: string;
    readonly portee: string;
};
export interface TexteApplicable {
    mentions: readonly Mention[];
    texte: string;
    source: string;
    article: string;
    numerotation: 'LETTRES' | 'TIRETS';
}
export declare function texteApplicable(dateFacture: Date | null): TexteApplicable;
export declare function renvoiALaMention(dateFacture: Date | null, cle: CleMention): string;
export interface Totaux {
    montantHT: number;
    montantNonTaxable: number;
    montantImposable: number;
    montantTva: number;
    montantAutresImpotsEtTaxes: number;
    montantTTC: number;
}
export declare function totauxFacture(f: Pick<FactureVerifiable, 'lignes'> & {
    autresImpotsEtTaxes?: number | null;
}): Totaux;
export interface ContexteMentions {
    sensVente?: boolean;
    regimeExigibiliteTva?: string | null;
}
export declare const MENTION_AUTORISATION_DEBITS: {
    readonly texte: "Autorisation d'acquitter la TVA d'après les débits";
    readonly article: "décret n° 011/42, art. 60";
    readonly citation: string;
    readonly consequence: string;
    readonly reserveSanction: string;
};
export interface VerificationMentions {
    mentionDebitsExigee: boolean;
    mentionDebitsManquante: boolean;
    mentionDebits: typeof MENTION_AUTORISATION_DEBITS;
    conforme: boolean;
    texteApplicable: TexteApplicable;
    manquantes: {
        cle: CleMention;
        libelle: string;
    }[];
    presentes: CleMention[];
    horsDePortee: {
        cle: CleMention;
        libelle: string;
    }[];
    amendeUnitaire: number;
    reserveAmende: string;
    source: string;
}
export declare function verifierMentions(f: FactureVerifiable, personneMorale: boolean, contexte?: ContexteMentions): VerificationMentions;
