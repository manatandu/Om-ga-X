"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVISE_DE_LA_PAIE = exports.AVERTISSEMENT_DATE_DU_CALCUL = exports.jourDeKinshasa = exports.AVERTISSEMENT_ARTICLE_89 = void 0;
exports.jourLisible = jourLisible;
exports.usdEnFc = usdEnFc;
exports.messageCoursManquant = messageCoursManquant;
exports.motifRefusCotationGestionnairePaie = motifRefusCotationGestionnairePaie;
exports.messageCoursDejaCote = messageCoursDejaCote;
const echeance_1 = require("../../common/echeance");
exports.AVERTISSEMENT_ARTICLE_89 = "Code du travail, art. 89 : « La rémunération doit être stipulée en monnaie ayant cours légal en République " +
    'Démocratique du Congo. » Ce salaire est stipulé en dollars américains · il est converti en francs congolais au ' +
    'cours du jour saisi au dossier, règle retenue par le cabinet faute de texte qui fixe ce cours pour la paie.';
var echeance_2 = require("../../common/echeance");
Object.defineProperty(exports, "jourDeKinshasa", { enumerable: true, get: function () { return echeance_2.jourDeKinshasa; } });
function jourLisible(jour) {
    const iso = jour.toISOString().slice(0, 10);
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
}
function usdEnFc(montantUsd, cours) {
    const centimes = Math.round(montantUsd * cours * 100 * 1e6) / 1e6;
    return Math.ceil(centimes) / 100;
}
exports.AVERTISSEMENT_DATE_DU_CALCUL = "DATE DU COURS · la date de mise à disposition de la rémunération n'est pas déclarée · le cours retenu est celui " +
    "du jour du calcul, juste si le bulletin est émis le jour du paiement. Les prélèvements s'attachent à la mise à " +
    "disposition (loi n° 23/053, art. 115 ; arrêté du 19 février 2025, art. 3) · déclarez-la si elle diffère.";
function messageCoursManquant(jour, miseADispositionDeclaree = false) {
    if (miseADispositionDeclaree) {
        return (`Aucun cours du dollar américain (USD) n'est renseigné pour le ${jourLisible(jour)}, date de mise à disposition ` +
            'déclarée. Le salaire stipulé en dollars se convertit au cours de ce jour-là : le comptable le cote dans la ' +
            "fenêtre Devises (« Coter un cours », USD, à cette date). Le cours d’un autre jour n’est jamais repris.");
    }
    return (`Aucun cours du dollar américain (USD) n'est renseigné pour aujourd'hui, ${jourLisible(jour)}. ` +
        'Le salaire stipulé en dollars se convertit au cours du jour : cotez-le dans la fenêtre Devises (« Coter un ' +
        'cours », USD, date du jour), ouverte au gestionnaire de paie pour ce seul cours. Sans devise USD au dossier, ' +
        "l'administrateur l'ajoute d'abord. Le cours d’un autre jour n’est jamais repris.");
}
exports.DEVISE_DE_LA_PAIE = 'USD';
function motifRefusCotationGestionnairePaie(codeDevise, dateCours, maintenant) {
    if (codeDevise.toUpperCase() !== exports.DEVISE_DE_LA_PAIE) {
        return ('Le gestionnaire de paie ne cote que le dollar américain (USD), la seule devise que la paie convertit · ' +
            'les autres cours se cotent par le comptable.');
    }
    const jour = (0, echeance_1.jourDeKinshasa)(maintenant);
    if (new Date(dateCours).getTime() !== jour.getTime()) {
        return (`Le gestionnaire de paie ne cote que le cours du jour, celui que la paie lit : le ${jourLisible(jour)}. ` +
            'Un autre jour se cote par le comptable.');
    }
    return null;
}
function messageCoursDejaCote(jour) {
    return `Le cours de l'USD du ${jourLisible(jour)} est déjà coté, et la paie le lit · une correction se demande au comptable.`;
}
//# sourceMappingURL=conversion-usd.js.map