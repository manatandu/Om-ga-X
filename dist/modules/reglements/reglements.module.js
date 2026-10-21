"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReglementsModule = void 0;
const common_1 = require("@nestjs/common");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const lettrage_module_1 = require("../lettrage/lettrage.module");
const reglements_controller_1 = require("./reglements.controller");
const reglements_service_1 = require("./reglements.service");
const ordres_virement_controller_1 = require("./ordres-virement.controller");
const ordres_virement_service_1 = require("./ordres-virement.service");
const lots_virement_controller_1 = require("./lots-virement.controller");
const lots_virement_service_1 = require("./lots-virement.service");
const modes_reglement_controller_1 = require("./modes-reglement.controller");
const modes_reglement_service_1 = require("./modes-reglement.service");
let ReglementsModule = class ReglementsModule {
};
exports.ReglementsModule = ReglementsModule;
exports.ReglementsModule = ReglementsModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, comptabilite_module_1.ComptabiliteModule, lettrage_module_1.LettrageModule],
        controllers: [reglements_controller_1.ReglementsController, ordres_virement_controller_1.OrdresVirementController, lots_virement_controller_1.LotsVirementController, modes_reglement_controller_1.ModesReglementController],
        providers: [reglements_service_1.ReglementsService, ordres_virement_service_1.OrdresVirementService, lots_virement_service_1.LotsVirementService, modes_reglement_service_1.ModesReglementService],
        exports: [ordres_virement_service_1.OrdresVirementService],
    })
], ReglementsModule);
//# sourceMappingURL=reglements.module.js.map