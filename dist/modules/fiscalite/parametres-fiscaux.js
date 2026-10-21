"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXERCICES_OBSERVES_REGIME = exports.QUOTITES_PETITE_ENTREPRISE = exports.IMPOT_REVENU_PERSONNES_PHYSIQUES = exports.IMPOT_SOCIETES = exports.DERNIERE_VERIFICATION_FISCALE = void 0;
exports.DERNIERE_VERIFICATION_FISCALE = '2026-09-05';
exports.IMPOT_SOCIETES = {
    taux: 0.3,
    tauxMinimum: 0.01,
    exercicesReportDeficit: 3,
    acomptes: [
        { quotite: 0.3, echeance: '25 juillet' },
        { quotite: 0.3, echeance: '25 septembre' },
        { quotite: 0.2, echeance: '25 novembre' },
    ],
    echeanceDeclaration: '30 avril',
};
exports.IMPOT_REVENU_PERSONNES_PHYSIQUES = {
    seuilMicroEntreprise: 25_000_000,
    seuilPetiteEntreprise: 300_000_000,
    tauxPetiteEntreprise: { VENTE: 0.01, PRESTATIONS: 0.02 },
    forfaitMicroEntrepriseUsd: 30,
    tauxMinimumRegimeReel: 0.01,
    echeanceDeclaration: '30 avril',
};
exports.QUOTITES_PETITE_ENTREPRISE = [
    {
        rang: 1,
        quotite: 0.6,
        echeance: '31 janvier',
        source: 'Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 2',
        reserve: null,
    },
    {
        rang: 2,
        quotite: 0.4,
        echeance: '30 avril',
        source: 'Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 3',
        reserve: "Échéance à confirmer auprès du service gestionnaire : l'art. 57 quater, al. 3 écrit une seconde fois « La 1ère quotité est acquittée […] au plus tard le 30 avril de la même année ». Le défaut de rédaction est celui du texte officiel, repris tel quel par la compilation DGI au 19 juillet 2026.",
    },
];
exports.EXERCICES_OBSERVES_REGIME = 3;
//# sourceMappingURL=parametres-fiscaux.js.map