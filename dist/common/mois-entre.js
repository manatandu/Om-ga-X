"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moisEntre = moisEntre;
function moisEntre(debut, fin) {
    return (fin.getUTCFullYear() - debut.getUTCFullYear()) * 12 + (fin.getUTCMonth() - debut.getUTCMonth()) + 1;
}
//# sourceMappingURL=mois-entre.js.map