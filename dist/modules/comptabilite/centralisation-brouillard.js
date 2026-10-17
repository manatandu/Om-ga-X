"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOURS_CENTRALISATION = void 0;
exports.brouillardInvalidable = brouillardInvalidable;
exports.filtreBrouillardAValider = filtreBrouillardAValider;
exports.ancienneteJours = ancienneteJours;
exports.enRetardDeCentralisation = enRetardDeCentralisation;
const client_1 = require("@prisma/client");
exports.JOURS_CENTRALISATION = {
    [client_1.Referentiel.SYCEBNL]: 7,
    [client_1.Referentiel.SYSCOHADA]: 30,
};
function brouillardInvalidable(e, statutExercice) {
    return e.estANouveauProvisoire || (e.estGenereeParCloture && statutExercice === client_1.StatutExercice.CLOTURE);
}
function filtreBrouillardAValider(statutExercice) {
    return {
        estANouveauProvisoire: false,
        ...(statutExercice === client_1.StatutExercice.CLOTURE ? { estGenereeParCloture: false } : {}),
    };
}
function ancienneteJours(createdAt, maintenant) {
    return Math.floor((maintenant - createdAt.getTime()) / 86_400_000);
}
function enRetardDeCentralisation(e, statutExercice, referentiel, maintenant) {
    return (!brouillardInvalidable(e, statutExercice) &&
        (maintenant - e.createdAt.getTime()) / 86_400_000 > exports.JOURS_CENTRALISATION[referentiel]);
}
//# sourceMappingURL=centralisation-brouillard.js.map