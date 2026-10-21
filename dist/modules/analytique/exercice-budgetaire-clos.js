"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_EXERCICE_BUDGETAIRE_CLOS = void 0;
exports.refuserSiExerciceBudgetaireClos = refuserSiExerciceBudgetaireClos;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.MOTIF_EXERCICE_BUDGETAIRE_CLOS = "L'exercice est clôturé · son budget et ses engagements ne se modifient plus, comme son analytique : " +
    "le tableau d'exécution budgétaire d'un exercice arrêté ne doit pas changer après coup.";
function refuserSiExerciceBudgetaireClos(statut) {
    if (statut === client_1.StatutExercice.CLOTURE)
        throw new common_1.BadRequestException(exports.MOTIF_EXERCICE_BUDGETAIRE_CLOS);
}
//# sourceMappingURL=exercice-budgetaire-clos.js.map