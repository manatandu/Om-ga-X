"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.libelleExercice = libelleExercice;
function libelleExercice(exercice) {
    const debut = exercice.dateDebut.getUTCFullYear();
    const fin = exercice.dateFin.getUTCFullYear();
    return debut === fin ? String(debut) : `${debut}-${fin}`;
}
//# sourceMappingURL=libelle-exercice.js.map