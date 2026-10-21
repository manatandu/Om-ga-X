"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bornesDuMois = bornesDuMois;
function bornesDuMois(dateDebutExercice, mois) {
    const annee = dateDebutExercice.getUTCFullYear() + (mois < dateDebutExercice.getUTCMonth() + 1 ? 1 : 0);
    return {
        debut: new Date(Date.UTC(annee, mois - 1, 1)),
        fin: new Date(Date.UTC(annee, mois, 0, 23, 59, 59)),
    };
}
//# sourceMappingURL=mois-de-l-exercice.js.map