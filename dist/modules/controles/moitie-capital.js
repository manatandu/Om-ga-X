"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regimeMoitieCapital = regimeMoitieCapital;
exports.formesDuRegimeMoitieCapital = formesDuRegimeMoitieCapital;
exports.verdictMoitieCapital = verdictMoitieCapital;
const client_1 = require("@prisma/client");
function regimeMoitieCapital(forme) {
    return forme === client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE
        ? 'SARL'
        : forme === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME
            ? 'SA'
            : forme === client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE
                ? 'SAS'
                : null;
}
function formesDuRegimeMoitieCapital(regimes) {
    return Object.values(client_1.FormeJuridiqueSyscohada).filter((f) => {
        const r = regimeMoitieCapital(f);
        return r !== null && regimes.includes(r);
    });
}
function verdictMoitieCapital(forme, totalCapitauxPropresBilan, capitalNonAppele, capitalNominal) {
    if (capitalNominal <= 0.005)
        return null;
    const regime = regimeMoitieCapital(forme);
    if (!regime)
        return null;
    const capitauxPropres = Math.round((totalCapitauxPropresBilan + Math.max(0, capitalNonAppele)) * 100) / 100;
    if (capitauxPropres >= capitalNominal / 2)
        return null;
    const lecture = 'Capitaux propres au sens de l’AUDCIF, Titre VIII ch. 16, section 3 · total des capitaux propres du bilan ' +
        '(subventions d’investissement et provisions réglementées comprises), augmenté du capital non appelé.';
    if (regime === 'SARL') {
        return {
            capitauxPropres,
            capital: capitalNominal,
            consequence: 'Les capitaux propres sont inférieurs à la moitié du capital social. Si c’est du fait des pertes constatées ' +
                'dans les états financiers de synthèse, le gérant ou, le cas échéant, le commissaire aux comptes doit, dans ' +
                'les quatre mois qui suivent l’approbation des comptes, consulter les associés sur la dissolution anticipée ' +
                '(AUSCGIE art. 371). Si elle est écartée, les capitaux propres se reconstituent dans les deux ans qui suivent ' +
                'la clôture de l’exercice déficitaire, sinon le capital se réduit, jamais sous le capital légal (art. 372) ; ' +
                'à défaut, tout intéressé peut demander la dissolution (art. 373). L’art. 901 punit les dirigeants. ' +
                lecture,
            action: 'Préparez la consultation des associés · OmegaX ne connaît pas la date d’approbation et ne calcule aucun ' +
                'délai.',
        };
    }
    const organe = regime === 'SA'
        ? 'le conseil d’administration ou l’administrateur général, selon le cas, convoque l’assemblée générale ' +
            'extraordinaire'
        : 'les associés décident collectivement, dans les conditions des statuts (art. 853-11, al. 2, par le renvoi de ' +
            'l’art. 853-3)';
    return {
        capitauxPropres,
        capital: capitalNominal,
        consequence: 'Les capitaux propres sont inférieurs à la moitié du capital social. Si c’est du fait des pertes constatées ' +
            `dans les états financiers de synthèse, ${organe} dans les quatre mois qui suivent l’approbation des comptes, ` +
            'pour décider de la dissolution anticipée (AUSCGIE art. 664). Si elle n’est pas prononcée, le capital se ' +
            'réduit au plus tard à la clôture du deuxième exercice suivant, faute de reconstitution (art. 665). Ces ' +
            'règles ne valent pas en redressement judiciaire ou en liquidation des biens (art. 669), état que le dossier ' +
            'ne porte pas. L’art. 901 punit les dirigeants. ' +
            lecture,
        action: 'Préparez la décision sur la dissolution anticipée · OmegaX ne connaît pas la date d’approbation et ne ' +
            'calcule aucun délai.',
    };
}
//# sourceMappingURL=moitie-capital.js.map