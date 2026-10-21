"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estJourRemunere = exports.estJourOuvrableDuCode = void 0;
exports.congeDuFerieDuDimanche = congeDuFerieDuDimanche;
exports.natureDuJour = natureDuJour;
const jour_ouvrable_1 = require("../retenues/jour-ouvrable");
const lendemain = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
function congeDuFerieDuDimanche(d) {
    if (d.getUTCDay() !== 6)
        return null;
    return (0, jour_ouvrable_1.jourFerie)(lendemain(d));
}
function natureDuJour(d) {
    if (d.getUTCDay() === 0)
        return 'DIMANCHE';
    if ((0, jour_ouvrable_1.jourFerie)(d) !== null)
        return 'FERIE';
    if (congeDuFerieDuDimanche(d) !== null)
        return 'CONGE_DU_FERIE_DU_DIMANCHE';
    return 'OUVRABLE';
}
const estJourOuvrableDuCode = (d) => natureDuJour(d) === 'OUVRABLE';
exports.estJourOuvrableDuCode = estJourOuvrableDuCode;
const estJourRemunere = (d) => natureDuJour(d) !== 'DIMANCHE';
exports.estJourRemunere = estJourRemunere;
//# sourceMappingURL=jours-du-code-du-travail.js.map