"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenceDeCellule = licenceDeCellule;
exports.refuserCelluleEditeur = refuserCelluleEditeur;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function licenceDeCellule(mere) {
    if (!mere)
        return null;
    if (mere.type === client_1.TypeLicence.PROPRIETAIRE) {
        throw new common_1.BadRequestException('Le dossier de l’éditeur n’a pas de cellules · chacune recevrait sa licence, et deviendrait un second dossier incoupable.');
    }
    return { type: mere.type, statut: mere.statut, dateExpiration: mere.dateExpiration };
}
function refuserCelluleEditeur(type) {
    if (type === client_1.TypeLicence.PROPRIETAIRE) {
        throw new common_1.BadRequestException('Le dossier de l’éditeur ne devient pas une cellule · sa licence ne se reflète sur aucune autre.');
    }
}
//# sourceMappingURL=licence-de-cellule.js.map