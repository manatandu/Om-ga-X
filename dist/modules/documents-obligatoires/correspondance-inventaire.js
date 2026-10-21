"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECTIONS_RAPPORT_ACTIVITE = exports.ETATS_INVENTAIRE_SMT = exports.ETATS_INVENTAIRE_PROJETS = exports.ETATS_INVENTAIRE_ASSOCIATIONS = void 0;
exports.etatsExigesPar = etatsExigesPar;
const client_1 = require("@prisma/client");
const NON_CONSTRUIT = (article) => `État exigé par l'article 14 mais non encore produit par OmegaX (${article}). Il doit être établi hors application et joint au livre d'inventaire tant que cette lacune subsiste.`;
exports.ETATS_INVENTAIRE_ASSOCIATIONS = [
    { cle: 'bilan', libelle: 'Bilan', disponible: true },
    { cle: 'compteDeResultat', libelle: 'Compte de résultat', disponible: true },
    { cle: 'tableauFluxTresorerie', libelle: 'Tableau des flux de trésorerie', disponible: true },
];
exports.ETATS_INVENTAIRE_PROJETS = [
    { cle: 'tableauEmploisRessources', libelle: 'Tableau emplois-ressources', disponible: true },
    { cle: 'tableauExecutionBudgetaire', libelle: "Tableau d'exécution budgétaire", disponible: true },
    { cle: 'tableauReconciliationTresorerie', libelle: 'Tableau de réconciliation de trésorerie', disponible: true },
    { cle: 'bilan', libelle: 'Bilan', disponible: true },
    { cle: 'compteExploitation', libelle: "Compte d'exploitation", disponible: true },
];
exports.ETATS_INVENTAIRE_SMT = [
    { cle: 'bilan', libelle: 'Bilan', disponible: true },
    { cle: 'compteDeResultat', libelle: 'Compte de résultat', disponible: true },
];
function etatsExigesPar(jeu) {
    switch (jeu) {
        case client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT:
            return exports.ETATS_INVENTAIRE_PROJETS;
        case client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE:
            return exports.ETATS_INVENTAIRE_SMT;
        default:
            return exports.ETATS_INVENTAIRE_ASSOCIATIONS;
    }
}
exports.SECTIONS_RAPPORT_ACTIVITE = [
    {
        cle: 'situationExerciceEcoule',
        titre: "Situation de l'entité durant l'exercice écoulé",
        exigence: "Art. 16-3 : « le rapport d'activité expose la situation de l'entité durant l'exercice écoulé ».",
    },
    {
        cle: 'perspectivesDeveloppement',
        titre: 'Perspectives de développement ou évolution prévisible',
        exigence: "Art. 16-3 : « ses perspectives de développement ou son évolution prévisible ».",
    },
    {
        cle: 'evolutionTresorerie',
        titre: 'Évolution de la situation de trésorerie',
        exigence: "Art. 16-3 : « et l'évolution de la situation de trésorerie ».",
    },
    {
        cle: 'evenementsPosterieurs',
        titre: 'Événements importants postérieurs à la clôture',
        exigence: "Art. 16-3 : « les événements importants, survenus entre la date de clôture de l'exercice et la date à laquelle il est établi, doivent également y être mentionnés ».",
    },
];
//# sourceMappingURL=correspondance-inventaire.js.map