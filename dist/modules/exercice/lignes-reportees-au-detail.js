"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lignesReporteesAuDetail = lignesReporteesAuDetail;
const client_1 = require("@prisma/client");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
function lignesReporteesAuDetail(ecriture) {
    return {
        ecriture: (0, ecritures_de_situation_1.avecStatut)(ecriture),
        compte: { modeReportANouveau: client_1.ModeReportANouveau.DETAIL },
        OR: [
            { lettre: null },
            { lettre: '' },
            { lettrage: { lignes: { some: { ecriture: { tenantId: ecriture.tenantId, exerciceId: { not: ecriture.exerciceId } } } } } },
        ],
    };
}
//# sourceMappingURL=lignes-reportees-au-detail.js.map