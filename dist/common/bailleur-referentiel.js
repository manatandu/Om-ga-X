"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refuserBailleurHorsSycebnl = refuserBailleurHorsSycebnl;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
async function refuserBailleurHorsSycebnl(prisma, tenantId, bailleurId) {
    if (!bailleurId)
        return;
    const { referentiel } = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { referentiel: true },
    });
    if (referentiel !== client_1.Referentiel.SYCEBNL) {
        throw new common_1.BadRequestException("Le rattachement à un bailleur de fonds n'existe qu'en SYCEBNL, dont la division 46 porte les bailleurs et " +
            'fonds d’administration. Au plan SYSCOHADA, le compte 46 porte les apporteurs, associés et groupe.');
    }
}
//# sourceMappingURL=bailleur-referentiel.js.map