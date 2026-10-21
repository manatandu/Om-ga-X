"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const modules_optionnels_1 = require("./modules-optionnels");
describe('modules servis', () => {
    it('le dossier de l’éditeur reçoit tous les modules, même aucun coché', () => {
        expect((0, modules_optionnels_1.modulesServis)([], client_1.TypeLicence.PROPRIETAIRE)).toEqual([...modules_optionnels_1.MODULES_OPTIONNELS]);
        expect((0, modules_optionnels_1.modulesServis)(null, client_1.TypeLicence.PROPRIETAIRE)).toEqual([...modules_optionnels_1.MODULES_OPTIONNELS]);
    });
    it('un dossier client garde ce qu’il a coché, rien de plus', () => {
        expect((0, modules_optionnels_1.modulesServis)([client_1.ModuleOptionnel.PAIE], client_1.TypeLicence.ABONNEMENT)).toEqual([client_1.ModuleOptionnel.PAIE]);
        expect((0, modules_optionnels_1.modulesServis)([], client_1.TypeLicence.ABONNEMENT)).toEqual([]);
        expect((0, modules_optionnels_1.modulesServis)([client_1.ModuleOptionnel.IFRS], null)).toEqual([client_1.ModuleOptionnel.IFRS]);
    });
});
//# sourceMappingURL=modules-servis.spec.js.map