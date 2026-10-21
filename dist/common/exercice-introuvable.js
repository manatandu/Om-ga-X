"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_EXERCICE_INTROUVABLE = void 0;
exports.exerciceDuDossierOuRefus = exerciceDuDossierOuRefus;
const common_1 = require("@nestjs/common");
exports.MOTIF_EXERCICE_INTROUVABLE = 'Exercice introuvable dans ce dossier : aucun état ne peut être établi.';
function exerciceDuDossierOuRefus(exercice) {
    if (!exercice)
        throw new common_1.NotFoundException(exports.MOTIF_EXERCICE_INTROUVABLE);
    return exercice;
}
//# sourceMappingURL=exercice-introuvable.js.map