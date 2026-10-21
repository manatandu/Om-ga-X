"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAUTS_EN_LIGNE = void 0;
exports.sautsDeConfiance = sautsDeConfiance;
const mode_installation_1 = require("./mode-installation");
exports.SAUTS_EN_LIGNE = 2;
function sautsDeConfiance(env = process.env) {
    const declare = env.SAUTS_PROXY_CONFIANCE;
    if (declare !== undefined && declare.trim() !== '') {
        if (!/^\d+$/.test(declare.trim())) {
            throw new Error(`SAUTS_PROXY_CONFIANCE doit être un entier positif ou nul · « ${declare} » ne l'est pas.`);
        }
        return Number(declare.trim());
    }
    return (0, mode_installation_1.estSurSite)(env) ? 0 : exports.SAUTS_EN_LIGNE;
}
//# sourceMappingURL=sauts-de-confiance.js.map