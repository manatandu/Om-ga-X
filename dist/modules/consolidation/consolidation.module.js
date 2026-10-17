"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsolidationModule = void 0;
const common_1 = require("@nestjs/common");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const consolidation_controller_1 = require("./consolidation.controller");
const perimetre_service_1 = require("./perimetre.service");
const cumul_service_1 = require("./cumul.service");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const etats_financiers_syscohada_module_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.module");
const etats_consolides_service_1 = require("./etats-consolides.service");
let ConsolidationModule = class ConsolidationModule {
};
exports.ConsolidationModule = ConsolidationModule;
exports.ConsolidationModule = ConsolidationModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, comptabilite_module_1.ComptabiliteModule, etats_financiers_syscohada_module_1.EtatsFinanciersSyscohadaModule],
        controllers: [consolidation_controller_1.ConsolidationController],
        providers: [perimetre_service_1.PerimetreService, cumul_service_1.CumulService, etats_consolides_service_1.EtatsConsolidesService],
        exports: [perimetre_service_1.PerimetreService, cumul_service_1.CumulService],
    })
], ConsolidationModule);
//# sourceMappingURL=consolidation.module.js.map