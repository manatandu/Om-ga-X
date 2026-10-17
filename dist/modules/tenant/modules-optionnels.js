"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULES_OPTIONNELS = void 0;
exports.normaliserModules = normaliserModules;
exports.modulesServis = modulesServis;
const client_1 = require("@prisma/client");
exports.MODULES_OPTIONNELS = [
    client_1.ModuleOptionnel.PAIE,
    client_1.ModuleOptionnel.REVISION,
    client_1.ModuleOptionnel.GESTION_COMMERCIALE,
    client_1.ModuleOptionnel.CONSOLIDATION,
    client_1.ModuleOptionnel.IFRS,
];
function normaliserModules(modules) {
    return exports.MODULES_OPTIONNELS.filter((m) => modules.includes(m));
}
function modulesServis(modulesActives, typeLicence) {
    if (typeLicence === client_1.TypeLicence.PROPRIETAIRE)
        return [...exports.MODULES_OPTIONNELS];
    return normaliserModules(modulesActives ?? []);
}
//# sourceMappingURL=modules-optionnels.js.map