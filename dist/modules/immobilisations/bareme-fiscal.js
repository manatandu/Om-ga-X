"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.natureDuBareme = natureDuBareme;
exports.baremeFiscal = baremeFiscal;
const bareme_amortissement_013_2025_1 = require("./bareme-amortissement-013-2025");
const PAR_CLE = new Map(bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025.map((n) => [n.cle, n]));
function natureDuBareme(cle) {
    return PAR_CLE.get(cle);
}
function baremeFiscal() {
    return bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025;
}
//# sourceMappingURL=bareme-fiscal.js.map