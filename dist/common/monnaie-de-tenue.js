"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONNAIE_DE_TENUE = void 0;
exports.monnaieDuJeuLegal = monnaieDuJeuLegal;
exports.MONNAIE_DE_TENUE = 'CDF';
function monnaieDuJeuLegal(deviseDuDossier) {
    return deviseDuDossier ?? exports.MONNAIE_DE_TENUE;
}
//# sourceMappingURL=monnaie-de-tenue.js.map