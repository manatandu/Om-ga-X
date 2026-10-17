"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiersModule = void 0;
const common_1 = require("@nestjs/common");
const tiers_service_1 = require("./tiers.service");
const tiers_controller_1 = require("./tiers.controller");
const documents_tiers_controller_1 = require("./documents-tiers.controller");
const documents_tiers_service_1 = require("./documents-tiers.service");
const ribs_tiers_controller_1 = require("./ribs-tiers.controller");
const ribs_tiers_service_1 = require("./ribs-tiers.service");
const lieux_livraison_controller_1 = require("./lieux-livraison.controller");
const lieux_livraison_service_1 = require("./lieux-livraison.service");
const modeles_impression_controller_1 = require("./modeles-impression.controller");
const modeles_impression_service_1 = require("./modeles-impression.service");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let TiersModule = class TiersModule {
};
exports.TiersModule = TiersModule;
exports.TiersModule = TiersModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [tiers_controller_1.TiersController, tiers_controller_1.ModeleReglementController, documents_tiers_controller_1.DocumentsTiersController, ribs_tiers_controller_1.RibsTiersController, lieux_livraison_controller_1.LieuxLivraisonController, modeles_impression_controller_1.ModelesImpressionController],
        providers: [tiers_service_1.TiersService, documents_tiers_service_1.DocumentsTiersService, ribs_tiers_service_1.RibsTiersService, lieux_livraison_service_1.LieuxLivraisonService, modeles_impression_service_1.ModelesImpressionService],
        exports: [tiers_service_1.TiersService],
    })
], TiersModule);
//# sourceMappingURL=tiers.module.js.map