export declare const DERNIERE_VERIFICATION_FISCALE = "2026-09-05";
export declare const IMPOT_SOCIETES: {
    readonly taux: 0.3;
    readonly tauxMinimum: 0.01;
    readonly exercicesReportDeficit: 3;
    readonly acomptes: readonly [{
        readonly quotite: 0.3;
        readonly echeance: "25 juillet";
    }, {
        readonly quotite: 0.3;
        readonly echeance: "25 septembre";
    }, {
        readonly quotite: 0.2;
        readonly echeance: "25 novembre";
    }];
    readonly echeanceDeclaration: "30 avril";
};
export declare const IMPOT_REVENU_PERSONNES_PHYSIQUES: {
    readonly seuilMicroEntreprise: 25000000;
    readonly seuilPetiteEntreprise: 300000000;
    readonly tauxPetiteEntreprise: {
        readonly VENTE: 0.01;
        readonly PRESTATIONS: 0.02;
    };
    readonly forfaitMicroEntrepriseUsd: 30;
    readonly tauxMinimumRegimeReel: 0.01;
    readonly echeanceDeclaration: "30 avril";
};
export declare const QUOTITES_PETITE_ENTREPRISE: readonly [{
    readonly rang: 1;
    readonly quotite: 0.6;
    readonly echeance: "31 janvier";
    readonly source: "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 2";
    readonly reserve: string | null;
}, {
    readonly rang: 2;
    readonly quotite: 0.4;
    readonly echeance: "30 avril";
    readonly source: "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 3";
    readonly reserve: "Échéance à confirmer auprès du service gestionnaire : l'art. 57 quater, al. 3 écrit une seconde fois « La 1ère quotité est acquittée […] au plus tard le 30 avril de la même année ». Le défaut de rédaction est celui du texte officiel, repris tel quel par la compilation DGI au 19 juillet 2026.";
}];
export declare const EXERCICES_OBSERVES_REGIME = 3;
