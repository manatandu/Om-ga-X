"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATTENTES_MINUTES = exports.PLAFOND_TENTATIVES = void 0;
exports.attenteApresEchec = attenteApresEchec;
exports.prochainEssaiApresEchec = prochainEssaiApresEchec;
exports.statutApresEchec = statutApresEchec;
const client_1 = require("@prisma/client");
exports.PLAFOND_TENTATIVES = 5;
const MINUTE = 60_000;
exports.ATTENTES_MINUTES = [5, 15, 60, 240];
function attenteApresEchec(tentatives) {
    if (tentatives < 1)
        return null;
    if (tentatives >= exports.PLAFOND_TENTATIVES)
        return null;
    const minutes = exports.ATTENTES_MINUTES[Math.min(tentatives, exports.ATTENTES_MINUTES.length) - 1];
    return minutes * MINUTE;
}
function prochainEssaiApresEchec(tentatives, maintenant) {
    const attente = attenteApresEchec(tentatives);
    return attente === null ? null : new Date(maintenant.getTime() + attente);
}
function statutApresEchec(tentatives) {
    return tentatives >= exports.PLAFOND_TENTATIVES ? client_1.StatutMessage.ABANDONNE : client_1.StatutMessage.ECHEC;
}
//# sourceMappingURL=report-tentatives.js.map