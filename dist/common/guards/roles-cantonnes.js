"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLES_CANTONNES = void 0;
exports.routeOuverteAuRoleCantonne = routeOuverteAuRoleCantonne;
exports.rolesSatisfaits = rolesSatisfaits;
const client_1 = require("@prisma/client");
exports.ROLES_CANTONNES = [
    client_1.RoleUtilisateur.AIDE_COMPTABLE,
    client_1.RoleUtilisateur.GESTIONNAIRE_PAIE,
];
function accesParDefaut(role) {
    return role === client_1.RoleUtilisateur.AIDE_COMPTABLE;
}
function routeOuverteAuRoleCantonne(role, acces) {
    if (role === client_1.RoleUtilisateur.AIDE_COMPTABLE)
        return acces?.aideComptable ?? accesParDefaut(role);
    if (role === client_1.RoleUtilisateur.GESTIONNAIRE_PAIE)
        return acces?.gestionnairePaie ?? accesParDefaut(role);
    return true;
}
function rolesSatisfaits(role, rolesRequis, acces) {
    if (rolesRequis.includes(role))
        return true;
    if (!exports.ROLES_CANTONNES.includes(role))
        return false;
    if (!routeOuverteAuRoleCantonne(role, acces))
        return false;
    return rolesRequis.includes(client_1.RoleUtilisateur.COMPTABLE) || rolesRequis.includes(client_1.RoleUtilisateur.LECTURE_SEULE);
}
//# sourceMappingURL=roles-cantonnes.js.map