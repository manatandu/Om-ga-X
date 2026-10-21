"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECTIONS_RAPPORT_GESTION_AUSCOOP = exports.SECTION_PARTICIPATION_SALARIES_SA = exports.SECTION_MODIFICATIONS_AUSCGIE = exports.SECTIONS_RAPPORT_GESTION_AUSCGIE = exports.ETATS_INVENTAIRE_SMT_SYSCOHADA = exports.ETATS_INVENTAIRE_SYSTEME_NORMAL = void 0;
exports.etatsExigesParSysteme = etatsExigesParSysteme;
exports.regleRapportGestion = regleRapportGestion;
const client_1 = require("@prisma/client");
exports.ETATS_INVENTAIRE_SYSTEME_NORMAL = [
    { cle: 'bilan', libelle: 'Bilan', disponible: true },
    { cle: 'compteDeResultat', libelle: 'Compte de résultat', disponible: true },
    { cle: 'tableauFluxTresorerie', libelle: 'Tableau des flux de trésorerie', disponible: true },
];
exports.ETATS_INVENTAIRE_SMT_SYSCOHADA = [
    { cle: 'bilan', libelle: 'Bilan', disponible: true },
    { cle: 'compteDeResultat', libelle: 'Compte de résultat', disponible: true },
];
function etatsExigesParSysteme(systeme) {
    return systeme === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
        ? exports.ETATS_INVENTAIRE_SMT_SYSCOHADA
        : exports.ETATS_INVENTAIRE_SYSTEME_NORMAL;
}
exports.SECTIONS_RAPPORT_GESTION_AUSCGIE = [
    {
        cle: 'situationExerciceEcoule',
        titre: "Situation de la société durant l'exercice écoulé",
        exigence: "AUSCGIE art. 138 : « il expose la situation de la société durant l'exercice écoulé ».",
    },
    {
        cle: 'evolutionPrevisible',
        titre: 'Évolution prévisible',
        exigence: 'AUSCGIE art. 138 : « son évolution prévisible ».',
    },
    {
        cle: 'evenementsPosterieurs',
        titre: 'Événements importants survenus depuis la clôture',
        exigence: "AUSCGIE art. 138 : « les événements importants survenus entre la date de clôture de l'exercice et la date à laquelle il est établi ».",
    },
    {
        cle: 'continuationActivite',
        titre: "Perspectives de continuation de l'activité",
        exigence: "AUSCGIE art. 138 : « et, en particulier, les perspectives de continuation de l'activité ».",
    },
    {
        cle: 'evolutionTresorerie',
        titre: 'Évolution de la situation de trésorerie',
        exigence: "AUSCGIE art. 138 : « l'évolution de la situation de trésorerie ».",
    },
    {
        cle: 'planFinancement',
        titre: 'Plan de financement',
        exigence: 'AUSCGIE art. 138 : « et le plan de financement ».',
    },
];
exports.SECTION_MODIFICATIONS_AUSCGIE = {
    cle: 'modificationsPresentationMethodes',
    titre: 'Modifications de présentation ou de méthodes',
    exigence: "AUSCGIE art. 141 : « Toute modification dans la présentation des états financiers de synthèse ou dans les méthodes d'évaluation, d'amortissement ou de provisions conformes au droit comptable doit être signalée dans le rapport de gestion ». Écrire « Néant » s'il n'y en a pas.",
};
exports.SECTION_PARTICIPATION_SALARIES_SA = {
    cle: 'participationSalariesCapital',
    titre: 'État de la participation des salariés au capital',
    exigence: "AUSCGIE art. 547-1 : « Le rapport présenté par le conseil d'administration ou l'administrateur général, selon le cas, à l'assemblée générale rend compte annuellement de l'état de la participation des salariés au capital social au dernier jour de l'exercice ».",
};
exports.SECTIONS_RAPPORT_GESTION_AUSCOOP = [
    {
        cle: 'situationExerciceEcoule',
        titre: "Situation de la société coopérative durant l'exercice écoulé",
        exigence: "AUSCOOP art. 108 : « il expose la situation de la société coopérative durant l'exercice écoulé ».",
    },
    {
        cle: 'evolutionPrevisible',
        titre: 'Évolution prévisible',
        exigence: 'AUSCOOP art. 108 : « son évolution prévisible ».',
    },
    {
        cle: 'continuationActivite',
        titre: "Perspectives de continuation de l'activité",
        exigence: "AUSCOOP art. 108 : « et, en particulier, les perspectives de continuation de l'activité ».",
    },
    {
        cle: 'evolutionTresorerie',
        titre: 'Évolution de la situation de trésorerie',
        exigence: "AUSCOOP art. 108 : « l'évolution de la situation de trésorerie ».",
    },
    {
        cle: 'planFinancement',
        titre: 'Plan de financement',
        exigence: 'AUSCOOP art. 108 : « et le plan de financement ».',
    },
    {
        cle: 'promotionCooperateurs',
        titre: 'État de promotion des coopérateurs',
        exigence: "AUSCOOP art. 108, alinéa 2 : « Le comité de gestion ou le conseil d'administration expose également dans ce rapport, l'état de promotion des coopérateurs ».",
    },
    {
        cle: 'modificationsPresentationMethodes',
        titre: 'Modifications de présentation ou de méthodes',
        exigence: "AUSCOOP art. 111 : « Toute modification dans la présentation des états financiers de synthèse ou dans les méthodes d'évaluation, d'amortissement ou de provisions […] doit être signalée dans le rapport de gestion. » Écrire « Néant » s'il n'y en a pas.",
    },
];
function regleRapportGestion(forme) {
    switch (forme) {
        case client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME:
            return {
                genre: 'EXIGE',
                source: 'AUSCGIE, article 138 (transmission aux commissaires aux comptes : article 140)',
                organe: "le conseil d'administration ou l'administrateur général, selon le cas",
                sections: [...exports.SECTIONS_RAPPORT_GESTION_AUSCGIE, exports.SECTION_MODIFICATIONS_AUSCGIE, exports.SECTION_PARTICIPATION_SALARIES_SA],
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE:
        case client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
        case client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF:
        case client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE:
            return {
                genre: 'EXIGE',
                source: 'AUSCGIE, article 138 (transmission aux commissaires aux comptes : article 140)',
                organe: "le gérant, le conseil d'administration ou l'administrateur général, selon le cas",
                sections: [...exports.SECTIONS_RAPPORT_GESTION_AUSCGIE, exports.SECTION_MODIFICATIONS_AUSCGIE],
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE:
            return {
                genre: 'EXIGE',
                source: 'AUSCOOP, article 108',
                organe: "le comité de gestion ou le conseil d'administration, selon le cas",
                sections: exports.SECTIONS_RAPPORT_GESTION_AUSCOOP,
            };
        case client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE:
            return {
                genre: 'AUCUNE_REGLE_LUE',
                motif: "Aucun texte lu n'impose de rapport de gestion au groupement d'intérêt économique · l'AUSCGIE y renvoie au contrat constitutif (« le contrôle de la gestion et le contrôle des états financiers de synthèse sont exercés dans les conditions prévues par le contrat »). Se reporter au contrat du groupement.",
            };
        default:
            return {
                genre: 'AUCUNE_REGLE_LUE',
                motif: "L'article 138 DE L'AUSCGIE nomme « le gérant, le conseil d'administration ou l'administrateur général » · un commerçant personne physique ou un entreprenant n'est aucun des trois, et ne rend compte devant aucune assemblée. Le livre d'inventaire, lui, reste dû (AUDCIF art. 19).",
            };
    }
}
//# sourceMappingURL=correspondance-inventaire-syscohada.js.map