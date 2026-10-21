"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.colonneLibreEnSaisie = colonneLibreEnSaisie;
exports.celluleLibreEnSaisie = celluleLibreEnSaisie;
function colonneLibreEnSaisie(colonne) {
    return colonne.type === 'LIBRE' && colonne.saisieSurLigneChiffree === true;
}
function celluleLibreEnSaisie(spec, rubrique) {
    return (!rubrique.saisie &&
        rubrique.cle !== undefined &&
        rubrique.totalDeRubriques === undefined &&
        spec.colonnes.some(colonneLibreEnSaisie));
}
//# sourceMappingURL=cellules-libres-en-saisie.js.map