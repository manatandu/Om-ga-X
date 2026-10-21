"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siSycebnl = siSycebnl;
const client_1 = require("@prisma/client");
function siSycebnl(referentiel, valeur) {
    return referentiel === client_1.Referentiel.SYCEBNL ? valeur : null;
}
//# sourceMappingURL=reponse-referentiel.js.map