"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODELE_KAHASHA = exports.PART_MAIN_OEUVRE_LOCALE_MINIMALE = void 0;
exports.articleTrenteSeptApplicable = articleTrenteSeptApplicable;
exports.etatAccordCadre = etatAccordCadre;
const client_1 = require("@prisma/client");
const ajouter_mois_1 = require("../../common/ajouter-mois");
function articleTrenteSeptApplicable(formeJuridique, droitEtranger) {
    return formeJuridique === client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE && droitEtranger;
}
exports.PART_MAIN_OEUVRE_LOCALE_MINIMALE = 60;
exports.MODELE_KAHASHA = {
    dureeAnnees: 10,
    preavisMois: 6,
    source: "Article IX du MODÈLE d'accord-cadre de partenariat, annexe VIII du guide pratique pour la constitution " +
        "des ONG en RDC (cabinet Kahasha) · ce n'est PAS une règle de la loi n° 004/2001, dont l'art. 37 ne fixe " +
        'aucune durée. À confronter à l’accord réellement signé.',
};
function etatAccordCadre(params) {
    const { dateSignature, dureeAnnees, taciteReconduction, preavisMois, denonceLe, reference } = params;
    const finDe = (rang) => (0, ajouter_mois_1.ajouterMois)(dateSignature, 12 * dureeAnnees * rang);
    const jusqua = denonceLe ?? reference;
    let rang = 1;
    let fin = finDe(rang);
    if (taciteReconduction) {
        while (fin.getTime() <= jusqua.getTime() && rang < 100 && dureeAnnees > 0) {
            rang += 1;
            fin = finDe(rang);
        }
    }
    const dernierJourPourDenoncer = preavisMois === null
        ? null
        : (0, ajouter_mois_1.ajouterMois)(fin, -preavisMois);
    return {
        finDePeriode: fin,
        periodeEcoulee: fin.getTime() <= reference.getTime(),
        enTaciteReconduction: taciteReconduction && !denonceLe,
        dernierJourPourDenoncer,
        denonciationHorsPreavis: denonceLe && dernierJourPourDenoncer ? denonceLe.getTime() > dernierJourPourDenoncer.getTime() : null,
    };
}
//# sourceMappingURL=conditions-ong-etrangere.js.map