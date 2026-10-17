"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lirePaiementsEnInstance = lirePaiementsEnInstance;
const common_1 = require("@nestjs/common");
function lirePaiementsEnInstance(valeur) {
    if (valeur === undefined || valeur.trim() === '')
        return null;
    const montant = Number(valeur);
    if (!Number.isFinite(montant)) {
        throw new common_1.BadRequestException("Paiements en instance illisibles · saisissez un montant, ou laissez le champ vide s'ils ne sont pas renseignés.");
    }
    return montant;
}
//# sourceMappingURL=paiements-en-instance.js.map