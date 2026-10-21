"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formeApplicable = formeApplicable;
exports.exerciceDeTransformation = exerciceDeTransformation;
exports.motifRefusTransformation = motifRefusTransformation;
const mentions_societe_1 = require("./mentions-societe");
function formeApplicable(t, dateFinExercice) {
    if (t.dateTransformationForme && t.formeJuridiqueSyscohadaAnterieure && dateFinExercice < t.dateTransformationForme) {
        return t.formeJuridiqueSyscohadaAnterieure;
    }
    return t.formeJuridiqueSyscohada;
}
function exerciceDeTransformation(t, exercice) {
    const d = t.dateTransformationForme;
    return Boolean(d && t.formeJuridiqueSyscohadaAnterieure && d >= exercice.dateDebut && d <= exercice.dateFin);
}
function motifRefusTransformation(ancienne, nouvelle, dateEffet, aujourdHui) {
    if (!ancienne || ancienne === nouvelle) {
        return 'Une transformation change la forme d’une société (AUSCGIE art. 181) · la forme actuelle n’est pas renseignée, ou elle est la même.';
    }
    if (!mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(ancienne) || !mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(nouvelle)) {
        return ('La transformation de l’art. 181 de l’AUSCGIE change la forme d’une société commerciale en une autre · un ' +
            'passage vers ou depuis une forme qui n’en est pas une relève d’un autre texte (art. 188) et ne se déclare ' +
            'pas comme une transformation. Enregistrez la forme sans date d’effet si c’est une correction.');
    }
    if (dateEffet > aujourdHui) {
        return 'La transformation prend effet au jour de la décision qui la constate (AUSCGIE art. 182) · une décision future ne se déclare pas.';
    }
    return null;
}
//# sourceMappingURL=forme-applicable.js.map