"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compteSeme = compteSeme;
exports.etiquette = etiquette;
exports.toutesLesRubriques = toutesLesRubriques;
exports.codesDistincts = codesDistincts;
const compte_seed_1 = require("../comptes/compte-seed");
const NUMEROS_SEMES = compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => c.numero);
function compteSeme(prefixe) {
    return NUMEROS_SEMES.some((n) => n.startsWith(prefixe) || prefixe.startsWith(n));
}
function etiquette(n) {
    return n.sousTableau ? `${n.code} / ${n.sousTableau}` : n.code;
}
function toutesLesRubriques(table) {
    return table.flatMap((n) => n.rubriques.map((r, index) => ({ note: n, rubrique: r, index })));
}
function codesDistincts(table) {
    return [...new Set(table.map((n) => n.code))];
}
//# sourceMappingURL=notes-sycebnl.commun.js.map