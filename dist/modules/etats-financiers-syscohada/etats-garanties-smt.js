"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.etatsDesGarantiesDus = etatsDesGarantiesDus;
const client_1 = require("@prisma/client");
const mentions_societe_1 = require("../tenant/mentions-societe");
function etatsDesGarantiesDus(forme) {
    if (!forme)
        return null;
    if (mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(forme)) {
        return {
            article: 'AUSCGIE art. 139',
            etats: [
                'État des cautionnements, avals et garanties donnés par la société',
                'État des sûretés réelles consenties par la société',
            ],
        };
    }
    if (forme === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE) {
        return {
            article: 'AUSCOOP art. 109',
            etats: [
                'État des cautionnements, avals et autres garanties personnelles données par la société coopérative',
                'État des sûretés réelles consenties par la société coopérative',
            ],
        };
    }
    return null;
}
//# sourceMappingURL=etats-garanties-smt.js.map