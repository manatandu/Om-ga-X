"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGLE_GIE_EMETTEUR = exports.MOTIF_GIE_SANS_OBLIGATIONS = exports.MOTIF_COOPERATIVE = exports.REGLE_SYCEBNL = void 0;
exports.regleAuditeur = regleAuditeur;
const client_1 = require("@prisma/client");
exports.REGLE_SYCEBNL = {
    genre: 'ALTERNATIF',
    source: 'Acte uniforme SYCEBNL du 22 décembre 2022, article 19 (sanctions : articles 24 à 27)',
    seuilBilan: 100_000_000,
    seuilProduits: 200_000_000,
    libelleProduits: 'Ressources annuelles',
    seuilEffectif: 20,
};
const DEUX_SUR_TROIS_125_250 = {
    genre: 'DEUX_SUR_TROIS',
    seuilBilan: 125_000_000,
    seuilProduits: 250_000_000,
    libelleProduits: "Chiffre d'affaires annuel",
    seuilEffectif: 50,
};
const DEUX_SUR_TROIS_250_500 = {
    genre: 'DEUX_SUR_TROIS',
    seuilBilan: 250_000_000,
    seuilProduits: 500_000_000,
    libelleProduits: "Chiffre d'affaires annuel",
    seuilEffectif: 50,
};
const REGLES_SYSCOHADA = {
    [client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME]: {
        genre: 'TOUJOURS',
        source: 'AUSCGIE, article 702',
        motif: "Toute société anonyme désigne un commissaire aux comptes et un suppléant, sans condition de taille · deux et " +
            "deux suppléants si elle fait publiquement appel à l'épargne.",
    },
    [client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE]: {
        ...DEUX_SUR_TROIS_125_250,
        source: 'AUSCGIE, article 376',
    },
    [client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE]: {
        ...DEUX_SUR_TROIS_125_250,
        source: 'AUSCGIE, article 853-13',
    },
    [client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF]: {
        ...DEUX_SUR_TROIS_250_500,
        source: 'AUSCGIE, article 289-1',
    },
    [client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE]: {
        ...DEUX_SUR_TROIS_250_500,
        source: "AUSCGIE, article 289-1, applicable par l'article 293-1",
    },
};
exports.MOTIF_COOPERATIVE = "AUSCOOP, article 121 · la société coopérative avec conseil d'administration désigne au moins un commissaire aux " +
    'comptes lorsqu’elle compte plus de mille coopérateurs, un chiffre d’affaires supérieur à cent millions et un ' +
    'total de bilan supérieur à cinq millions ; la désignation est facultative pour la société coopérative simplifiée. ' +
    'OmegaX ne le mesure pas · le dossier ne dit pas s’il s’agit d’une SCOOPS ou d’une COOP-CA, et l’article n’écrit ' +
    'pas l’unité monétaire de ses deux montants.';
exports.MOTIF_GIE_SANS_OBLIGATIONS = 'AUSCGIE, article 880 · le contrôle des états financiers du groupement est exercé dans les conditions prévues par ' +
    'le contrat · un commissaire aux comptes n’est obligatoire que si le groupement émet des obligations (articles 875 ' +
    'et 880), ce qui se lit au compte 161 « Emprunts obligataires ».';
exports.REGLE_GIE_EMETTEUR = {
    genre: 'TOUJOURS',
    source: 'AUSCGIE, articles 875 et 880',
    motif: "Le groupement émet des obligations (compte 161 « Emprunts obligataires ») · le contrôle de ses états " +
        "financiers est exercé par un ou plusieurs commissaires aux comptes nommés par l'assemblée pour six " +
        'exercices, avec le statut du commissaire aux comptes de société anonyme.',
};
function regleAuditeur(referentiel, formeSyscohada, gieEmetDesObligations = null) {
    if (referentiel === client_1.Referentiel.SYCEBNL)
        return exports.REGLE_SYCEBNL;
    if (!formeSyscohada) {
        return {
            genre: 'AUCUNE_REGLE_LUE',
            motif: "La forme juridique du dossier n'est pas renseignée · l'obligation de désigner un commissaire aux comptes en " +
                'dépend entièrement. Renseignez-la dans Structure → Paramètres du dossier.',
        };
    }
    const regle = REGLES_SYSCOHADA[formeSyscohada];
    if (regle)
        return regle;
    if (formeSyscohada === client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE) {
        if (gieEmetDesObligations)
            return exports.REGLE_GIE_EMETTEUR;
        return {
            genre: 'AUCUNE_REGLE_LUE',
            motif: gieEmetDesObligations === false
                ? `${exports.MOTIF_GIE_SANS_OBLIGATIONS} Il ne porte aucun solde sur l'exercice.`
                : exports.MOTIF_GIE_SANS_OBLIGATIONS,
        };
    }
    if (formeSyscohada === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE) {
        return { genre: 'AUCUNE_REGLE_LUE', motif: exports.MOTIF_COOPERATIVE };
    }
    return {
        genre: 'AUCUNE_REGLE_LUE',
        motif: "Aucun seuil chiffré n'a été lu dans l'AUSCGIE pour cette forme juridique · le logiciel ne mesure donc rien " +
            "plutôt que de lui appliquer le seuil d'une autre forme.",
    };
}
//# sourceMappingURL=regles-auditeur.js.map