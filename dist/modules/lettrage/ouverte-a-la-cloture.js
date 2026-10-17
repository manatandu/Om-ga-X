"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ouverteALaCloture = ouverteALaCloture;
function ouverteALaCloture(dateFin) {
    return {
        OR: [{ lettre: null }, { lettrage: { lignes: { some: { ecriture: { date: { gt: dateFin } } } } } }],
    };
}
//# sourceMappingURL=ouverte-a-la-cloture.js.map