"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_LISTE_CONSOLE = void 0;
exports.tranche = tranche;
exports.PLAFOND_LISTE_CONSOLE = 500;
function tranche(rendus, total) {
    return { total, tronque: total > rendus, plafond: exports.PLAFOND_LISTE_CONSOLE };
}
//# sourceMappingURL=plafond-console.js.map