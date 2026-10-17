"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.comptesDeLaNature = comptesDeLaNature;
exports.naturesDuCompte = naturesDuCompte;
const bareme_comptes_013_2025_1 = require("./bareme-comptes-013-2025");
const PAR_CLE = new Map(bareme_comptes_013_2025_1.CORRESPONDANCE_BAREME_COMPTES.map((c) => [c.cle, c]));
function comptesDeLaNature(referentiel, cle) {
    return PAR_CLE.get(cle)?.[referentiel] ?? { comptes: [], remarque: '' };
}
const racine = (numero) => numero.replace(/0+$/, '');
function naturesDuCompte(referentiel, numero) {
    return bareme_comptes_013_2025_1.CORRESPONDANCE_BAREME_COMPTES.filter((c) => c[referentiel].comptes.some((n) => n === numero || numero.startsWith(racine(n)))).map((c) => c.cle);
}
//# sourceMappingURL=bareme-comptes.js.map