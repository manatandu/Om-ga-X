"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReserveAuComptable = exports.AccesRolesCantonnes = exports.CLE_ACCES_ROLES_CANTONNES = void 0;
const common_1 = require("@nestjs/common");
exports.CLE_ACCES_ROLES_CANTONNES = 'acces-roles-cantonnes';
const AccesRolesCantonnes = (acces) => (0, common_1.SetMetadata)(exports.CLE_ACCES_ROLES_CANTONNES, acces);
exports.AccesRolesCantonnes = AccesRolesCantonnes;
const ReserveAuComptable = () => (0, exports.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: false });
exports.ReserveAuComptable = ReserveAuComptable;
//# sourceMappingURL=acces-roles-cantonnes.decorator.js.map